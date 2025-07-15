import TelegramBot from "node-telegram-bot-api";
import { formatDateForTelegram, daysBetween, today } from "@/app/utils/date";

interface PortfolioData {
  date: string;
  value: number;
}

process.env.NTBA_FIX_350 = "1"; // From docs, to supress warning

export async function sendToTelegram(
  imageBuffer: Buffer,
  data: PortfolioData[]
) {
  if (!data || data.length === 0) {
    return { success: false, error: "No portfolio data provided" };
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return { success: false, error: "Missing Telegram credentials" };
  }

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!);
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  // Calculate metrics
  const currentValue = data[data.length - 1].value;
  const startValue = data[0].value;
  const totalReturn = ((currentValue - startValue) / startValue) * 100;
  const absoluteReturn = currentValue - startValue;
  const totalDays = data.length;

  // Calculate additional metrics
  let highestValue = data[0].value;
  let lowestValue = data[0].value;
  let highestValueData = data[0];
  let lowestValueData = data[0];

  for (let i = 1; i < data.length; i++) {
    const currentData = data[i];
    if (currentData.value > highestValue) {
      highestValue = currentData.value;
      highestValueData = currentData;
    }
    if (currentData.value < lowestValue) {
      lowestValue = currentData.value;
      lowestValueData = currentData;
    }
  }

  // Date calculations
  const daysDiff = daysBetween(data[0].date, data[data.length - 1].date);
  const weeksSinceStart = Math.floor(daysDiff / 7);
  const monthsSinceStart = Math.floor(daysDiff / 30);

  // Calculate recent performance (last 7 days if available)
  let recentPerformance = "";
  if (data.length >= 7) {
    const lastWeekValue = data[data.length - 7].value;
    const weeklyReturn = ((currentValue - lastWeekValue) / lastWeekValue) * 100;
    const weeklyChange = currentValue - lastWeekValue;
    recentPerformance =
      `📅 *7-Day Performance:*\n` +
      `${weeklyReturn >= 0 ? "+" : ""}${weeklyReturn.toFixed(2)}% (${
        weeklyChange >= 0 ? "+" : ""
      }$${weeklyChange.toLocaleString()})\n\n`;
  }

  // Build message
  const message =
    `📊 *Weekly Portfolio Update - ${today()}*\n\n` +
    `💰 Current Value: $${currentValue.toLocaleString()}\n` +
    `💰 Starting Value: $${startValue.toLocaleString()}\n` +
    `📈 Total Return: ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(
      2
    )}%\n` +
    `💵 Total Change: ${
      absoluteReturn >= 0 ? "+" : ""
    }$${absoluteReturn.toLocaleString()}\n\n` +
    recentPerformance +
    `📊 *Portfolio Stats:*\n` +
    `🏆 All-Time High: $${highestValue.toLocaleString()} (${formatDateForTelegram(
      highestValueData!.date
    )})\n` +
    `📉 All-Time Low: $${lowestValue.toLocaleString()} (${formatDateForTelegram(
      lowestValueData!.date
    )})\n` +
    `📅 Trading Days: ${totalDays}\n` +
    `🗓️ Period: ${daysDiff} days (${weeksSinceStart} weeks, ${monthsSinceStart} months)\n` +
    `📅 ${formatDateForTelegram(data[0].date)} - ${formatDateForTelegram(
      data[data.length - 1].date
    )}`;

  try {
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: message,
      parse_mode: "Markdown",
    });
    console.log("Weekly update sent to Telegram successfully");
  } catch (error) {
    console.error("Error sending to Telegram:", error);
  }
}
