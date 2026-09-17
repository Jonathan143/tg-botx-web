import type { ScheduleDefinition } from "@/lib/api/types";

export function clockSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value))
    return null;
  const [hour, minute, second = 0] = value.split(":").map(Number);
  return hour * 3600 + minute * 60 + second;
}

export function maxExecutions(schedule: ScheduleDefinition): number {
  if (schedule.type === "fixed") return 1;
  const start = clockSeconds(schedule.start);
  const end = clockSeconds(schedule.end);
  return start !== null && end !== null && end > start ? Math.min(1000, end - start + 1) : 1000;
}

export function validateScheduleExecution(schedule: ScheduleDefinition | undefined): string | null {
  if (!schedule || (schedule.type !== "fixed" && schedule.type !== "random"))
    return "请选择有效的执行时间类型。";
  const count = schedule.execution_count === undefined ? 1 : schedule.execution_count;
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    return "执行次数必须是 1–1000 的整数。";
  if (schedule.type === "fixed") {
    if (count !== 1) return "固定时间的执行次数只能为 1。";
    if (clockSeconds(schedule.time) === null) return "请配置有效的固定执行时间。";
  } else {
    const start = clockSeconds(schedule.start);
    const end = clockSeconds(schedule.end);
    if (start === null || end === null) return "请配置有效的随机窗口开始和结束时间。";
    if (end <= start) return "结束时间必须晚于开始时间，不支持跨午夜窗口。";
    if (count > maxExecutions(schedule)) return "执行次数不能超过窗口内可用的整秒时间点数量。";
  }
  return null;
}
