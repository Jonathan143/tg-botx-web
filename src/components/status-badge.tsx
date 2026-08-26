import { Badge } from "@/components/ui/badge";

const positiveStatuses = new Set([
  "healthy",
  "success",
  "completed",
  "enabled",
  "active",
  "authorized",
  "complete",
]);
const negativeStatuses = new Set([
  "failed",
  "error",
  "unavailable",
  "disabled",
  "inactive",
  "expired",
  "cancelled",
]);

const labels: Record<string, string> = {
  healthy: "正常",
  degraded: "部分异常",
  unavailable: "不可用",
  unknown: "未知",
  success: "成功",
  completed: "已完成",
  failed: "失败",
  error: "错误",
  running: "运行中",
  pending: "等待中",
  cancelled: "已取消",
  enabled: "已启用",
  disabled: "已停用",
  archived: "已归档",
  active: "活跃",
  inactive: "未激活",
  authorized: "已授权",
  complete: "已完成",
  expired: "已过期",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = (status ?? "unknown").toLowerCase();
  const variant = negativeStatuses.has(normalized)
    ? "destructive"
    : positiveStatuses.has(normalized)
      ? "default"
      : "secondary";
  return <Badge variant={variant}>{labels[normalized] ?? status ?? "未知"}</Badge>;
}
