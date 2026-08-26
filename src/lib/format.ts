export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export type DashboardRange = "24h" | "7d" | "30d";

const chartDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
});

const chartDayFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
});

function parseChartDate(value: string) {
  // Daily buckets are calendar dates, rather than instants in time. Parse them
  // as local dates so a user's timezone cannot move the label to the previous
  // or next day.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatChartLabel(value: string, range: DashboardRange) {
  const date = parseChartDate(value);
  if (!date) {
    return value;
  }

  if (range === "24h") {
    const parts = chartDateFormatter.formatToParts(date);
    const month = getDatePart(parts, "month");
    const day = getDatePart(parts, "day");
    const hour = getDatePart(parts, "hour");
    const minute = getDatePart(parts, "minute");
    return `${month}-${day} ${hour}:${minute}`;
  }

  const parts = chartDayFormatter.formatToParts(date);
  return `${getDatePart(parts, "month")}-${getDatePart(parts, "day")}`;
}

export function formatPercent(value: number) {
  const normalized = value > 1 ? value / 100 : value;
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(normalized);
}

export function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) {
    return "—";
  }
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(duration) || duration < 0) {
    return "—";
  }
  if (duration < 1000) {
    return `${duration} 毫秒`;
  }
  if (duration < 60_000) {
    return `${Math.round(duration / 1000)} 秒`;
  }
  return `${Math.round(duration / 60_000)} 分钟`;
}
