import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { Chart, registerables } from "chart.js";
import { parseStringDate, formatDateForChart, daysBetween } from "./date";

Chart.register(...registerables);

const FONT_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/fonts/font.ttf`;
const FONT_FAMILY_NAME = "Open Sans";

let fontRegistered = false;
let fontRegistrationPromise: Promise<void> | null = null;

async function registerFont() {
  if (fontRegistered) {
    return;
  }
  if (fontRegistrationPromise) {
    return fontRegistrationPromise;
  }

  fontRegistrationPromise = (async () => {
    try {
      const response = await fetch(FONT_URL);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch font: ${response.statusText} (${response.status})`
        );
      }
      const fontBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(fontBuffer);

      GlobalFonts.register(buffer, FONT_FAMILY_NAME);
      fontRegistered = true;
      Chart.defaults.font.family = FONT_FAMILY_NAME;
      Chart.defaults.font.size = 14;
      Chart.defaults.font.weight = "normal";
    } catch (error) {
      console.error(`Failed to register font from URL ${FONT_URL}:`, error);
      fontRegistrationPromise = null;
      throw error;
    } finally {
      if (!fontRegistered) {
        fontRegistrationPromise = null;
      }
    }
  })();
  return fontRegistrationPromise;
}

interface PortfolioData {
  date: string; // "yyyyMMdd" format
  value: number;
}

export async function generateChartImage(
  data: PortfolioData[]
): Promise<Buffer> {
  await registerFont();
  const width = 1200;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const processedData = data.map((d) => ({
    date: parseStringDate(d.date),
    value: d.value,
    dateString: d.date,
  }));

  const labels = processedData.map((d) => formatDateForChart(d.dateString));
  const values = processedData.map((d) => d.value);

  const currentValue = values[values.length - 1];
  const startValue = values[0];
  const totalReturn = ((currentValue - startValue) / startValue) * 100;
  const totalTradingDays = data.length;
  const totalCalendarDays = daysBetween(
    data[0].date,
    data[data.length - 1].date
  );

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1;

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Portfolio Value",
          data: values,
          borderColor:
            totalReturn >= 0 ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
          backgroundColor:
            totalReturn >= 0
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: `Portfolio Performance - ${totalCalendarDays} Days`,
          font: {
            size: 24,
            weight: "bold",
            family: FONT_FAMILY_NAME,
          },
          padding: {
            top: 20,
            bottom: 20,
          },
        },
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              const index = context[0].dataIndex;
              return formatDateForChart(data[index].date);
            },
            label: function (context) {
              return `$${Number(context.parsed.y).toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        y: {
          min: minValue - padding,
          max: maxValue + padding,
          ticks: {
            callback: function (value) {
              return "$" + Number(value).toLocaleString();
            },
            font: {
              size: 12,
              family: FONT_FAMILY_NAME,
            },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
        x: {
          ticks: {
            maxTicksLimit: getOptimalTickCount(totalTradingDays),
            font: {
              size: 10,
              family: FONT_FAMILY_NAME,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });

  chart.render();

  return canvas.toBuffer("image/png");
}

function getOptimalTickCount(totalDays: number): number {
  if (totalDays <= 7) return totalDays;
  if (totalDays <= 30) return 10;
  if (totalDays <= 90) return 15;
  if (totalDays <= 180) return 20;
  if (totalDays <= 365) return 25;
  return 30;
}
