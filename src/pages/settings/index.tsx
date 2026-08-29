import { useMutation, useQuery } from "@tanstack/react-query";

import { ConfirmAction } from "@/components/confirm-action";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { SettingsResponse } from "@/lib/api/types";
import { SettingsGroup } from "./components/settings-group";

export default function SettingsPage() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/api/settings"),
  });
  const rotateMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ keyId: string }>("/api/settings/transport-key/rotate", {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: (result) =>
      toast.add({
        type: "success",
        title: "传输密钥已轮换",
        description: `当前 keyId：${result.keyId}`,
      }),
    onError: (error) => toast.add({ type: "error", title: "轮换失败", description: error.message }),
  });
  const serviceSettings: SettingsResponse = query.data
    ? {
        apiHost: query.data.apiHost,
        apiPort: query.data.apiPort,
        dataDir: query.data.dataDir,
        telegramApiConfigured: query.data.telegramApiConfigured,
        notificationConfigured: query.data.notificationConfigured,
        notificationTimezone: query.data.notificationTimezone,
      }
    : {};
  const databaseSettings: SettingsResponse = query.data
    ? { database: query.data.database, databaseUrl: query.data.databaseUrl }
    : {};
  const schedulerSettings: SettingsResponse = query.data
    ? {
        logLevel: query.data.logLevel,
        logFile: query.data.logFile,
        logMaxBytes: query.data.logMaxBytes,
        logBackupCount: query.data.logBackupCount,
      }
    : {};
  const securitySettings: SettingsResponse = query.data
    ? {
        adminOrigin: query.data.adminOrigin,
        sessionDays: query.data.sessionDays,
        transportKeyRotationHours: query.data.transportKeyRotationHours,
        trustedProxiesConfigured: query.data.trustedProxiesConfigured,
        readOnly: query.data.readOnly,
      }
    : {};
  return (
    <>
      <PageHeader
        title="设置"
        description="仅展示后端返回的脱敏运行配置；环境变量仍由部署侧维护。"
        actions={
          <ConfirmAction
            title="立即轮换传输密钥？"
            description="新登录流程会立即使用新公钥；旧私钥仅保留短暂宽限期，已登录会话不受影响。"
            triggerLabel="轮换 RSA 密钥"
            actionLabel="确认轮换"
            onConfirm={() => rotateMutation.mutateAsync().then(() => undefined)}
          />
        }
      />
      <Alert>
        <AlertTitle>只读配置</AlertTitle>
        <AlertDescription>
          此页面不会回写 .env。修改管理访问密钥后需要重启 tg-bot，旧后台会话将失效。
        </AlertDescription>
      </Alert>
      {query.isPending && !query.data ? <PageSkeleton /> : null}
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsGroup
            title="服务"
            description="HTTP 服务与运行参数。"
            values={serviceSettings}
          />
          <SettingsGroup
            title="数据库"
            description="数据库类型与脱敏连接信息。"
            values={databaseSettings}
          />
          <SettingsGroup
            title="调度器"
            description="任务调度与日志配置。"
            values={schedulerSettings}
          />
          <SettingsGroup
            title="安全"
            description="会话、来源与传输密钥策略。"
            values={securitySettings}
          />
        </div>
      ) : null}
    </>
  );
}
