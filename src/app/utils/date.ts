import dayjs, { Dayjs } from "dayjs";

// Convert "YYYYMMDD" string to dayjs object
export function parseStringDate(dateString: string): Dayjs {
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return dayjs(`${year}-${month}-${day}`);
}

// Convert dayjs object to "YYYYMMDD" string
export function formatToStringDate(date: Dayjs): string {
  return date.format("YYYYMMDD");
}

// Format date for chart display
export function formatDateForChart(dateString: string): string {
  const date = parseStringDate(dateString);
  return date.format("MMM DD, YYYY");
}

// Format date for telegram message
export function formatDateForTelegram(dateString: string): string {
  const date = parseStringDate(dateString);
  return date.format("MMM DD YYYY");
}

// Get current date as string
export function getCurrentDateString(): string {
  return dayjs().format("YYYYMMDD");
}

// Check if a date string is today
export function isToday(dateString: string): boolean {
  return dateString === getCurrentDateString();
}

export function today(): string {
  return dayjs().format("MMM DD YYYY");
}

// Check if today is Friday
export function isFriday(): boolean {
  return dayjs().day() === 5; // 0 = Sunday, 5 = Friday
}

// Calculate days between two string dates
export function daysBetween(startDate: string, endDate: string): number {
  const start = parseStringDate(startDate);
  const end = parseStringDate(endDate);
  return end.diff(start, "day");
}

// Get date X days ago as string
export function getDaysAgo(days: number): string {
  return dayjs().subtract(days, "day").format("YYYYMMDD");
}

// Get all dates in a range (useful for filling gaps)
export function getDateRange(startDate: string, endDate: string): string[] {
  const start = parseStringDate(startDate);
  const end = parseStringDate(endDate);
  const dates: string[] = [];

  let current = start;
  while (current.isBefore(end) || current.isSame(end)) {
    dates.push(formatToStringDate(current));
    current = current.add(1, "day");
  }

  return dates;
}
