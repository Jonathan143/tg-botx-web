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
