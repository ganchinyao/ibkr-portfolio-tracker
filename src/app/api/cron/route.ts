import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { prisma } from "@/../lib/prisma";
import { generateChartImage } from "@/app/utils/chart";
import { sendToTelegram } from "@/../lib/telegram";
import { isFriday } from "@/app/utils/date";
import { uploadContentToBlob } from "@/app/utils/blob";

export async function GET(req: NextRequest) {
  if (
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1: Send request for flex query report
    const requestUrl = `https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest`;
    const requestParams = new URLSearchParams({
      t: process.env.IBKR_FLEX_TOKEN!,
      q: process.env.IBKR_FLEX_QUERY_ID!,
      v: "3", // version 3, from ibkr documentation
    });
    const requestResponse = await fetch(`${requestUrl}?${requestParams}`);
    const requestText = await requestResponse.text();

    // Parse the XML response to get the reference code
    const referenceCodeMatch = requestText.match(
      /<ReferenceCode>([^<]+)<\/ReferenceCode>/
    );
    const statusMatch = requestText.match(/<Status>([^<]+)<\/Status>/);

    if (!referenceCodeMatch || statusMatch?.[1] !== "Success") {
      console.error("Failed to request flex query:", requestText);
      throw new Error(
        `Failed to request flex query report: ${
          statusMatch?.[1] || "Unknown error"
        }`
      );
    }

    const referenceCode = referenceCodeMatch[1];

    // Step 2: Download the report using the reference code
    const downloadUrl = `https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement`;
    const downloadParams = new URLSearchParams({
      t: process.env.IBKR_FLEX_TOKEN!,
      q: referenceCode,
      v: "3",
    });

    const downloadResponse = await fetch(`${downloadUrl}?${downloadParams}`);
    if (downloadResponse.status !== 200) {
      throw new Error(
        `Failed to download flex query report, status: ${downloadResponse.status}`
      );
    }

    const reportData = await downloadResponse.text();
    const records = parse(reportData, {
      columns: true,
      skip_empty_lines: true,
    });
    const firstRecord = records[0];
    const date: string = firstRecord.FromDate; // yyyyMMdd format
    const endingValue = Number(parseFloat(firstRecord.EndingValue).toFixed(2));

    console.log({ date, endingValue });

    // Step 3. Update portfolio value to the database
    await prisma.portfolioValue.upsert({
      where: { date },
      update: { value: endingValue },
      create: { date, value: endingValue },
    });

    // Step 4. Send weekly report every friday to telegram
    if (isFriday()) {
      console.log("It's Friday, sending weekly update to Telegram");
      await sendWeeklyUpdate();
    } else {
      console.log("Not Friday, skipping weekly update");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error calling IBKR Flex Query:", error);

    // Since vercel free plan only stores log for 1hr, send logs to blob storage
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const errorLog = {
          timestamp: new Date().toISOString(),
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : "Unknown Error",
          },
          context: {
            endpoint: "/api/cron",
          },
        };

        const fileName = `error-logs/ibkr-flex-query-${Date.now()}.json`;
        await uploadContentToBlob(fileName, JSON.stringify(errorLog, null, 2), {
          contentType: "application/json",
          cacheControlMaxAge: 0,
        });

        console.log(`Error log uploaded to blob store: ${fileName}`);
      } catch (uploadError) {
        console.error("Failed to upload error log to blob store:", uploadError);
      }
    }
    return NextResponse.json(
      {
        error: "Failed to query",
      },
      { status: 500 }
    );
  }
}

async function sendWeeklyUpdate() {
  try {
    const portfolioData = await prisma.portfolioValue.findMany({
      orderBy: {
        date: "asc",
      },
    });

    if (portfolioData.length === 0) {
      console.log("No portfolio data found");
      return;
    }

    const chartBuffer = await generateChartImage(portfolioData);
    await sendToTelegram(chartBuffer, portfolioData);
  } catch (error) {
    console.error("Error sending weekly update:", error);
  }
}
