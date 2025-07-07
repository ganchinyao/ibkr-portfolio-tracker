import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { prisma } from "@/../lib/prisma";

export async function POST(req: NextRequest) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
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

    // // Step 2: Download the report using the reference code
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
    await prisma.portfolioValue.upsert({
      where: { date },
      update: { value: endingValue },
      create: { date, value: endingValue },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error calling IBKR Flex Query:", error);
    return NextResponse.json(
      {
        error: "Failed to query",
      },
      { status: 500 }
    );
  }
}
