import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmAction } from "@/components/confirm-action";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotBindingsResponse } from "@/lib/api/types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "未记录";
}

function bindingName(binding: BotBindingsResponse["bindings"][number]) {
  return binding.username
    ? `@${binding.username}`
    : [binding.firstName, binding.lastName].filter(Boolean).join(" ") || String(binding.userId);
}

export function ManagementBotPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bot-bindings"],
    queryFn: () => apiRequest<BotBindingsResponse>("/api/bot/bindings"),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; code: string; expiresAt: string }>("/api/bot/bindings", {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bot-bindings"] });
      toast.add({
        type: "success",
        title: "绑定码已生成",
        description: "请立即复制并发送给需要绑定的用户。",
      });
      window.prompt(
        "请复制一次性绑定码",
        `${result.code}\n有效期至：${formatDate(result.expiresAt)}`,
      );
    },
    onError: (error) =>
      toast.add({ type: "error", title: "生成绑定码失败", description: error.message }),
  });
  const revokeCodeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bot/binding-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-bindings"] }),
    onError: (error) =>
      toast.add({ type: "error", title: "撤销绑定码失败", description: error.message }),
  });
  const revokeBindingMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bot/bindings/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-bindings"] }),
    onError: (error) =>
      toast.add({ type: "error", title: "解除绑定失败", description: error.message }),
  });

  const data = query.data;
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Telegram 管理 Bot</CardTitle>
          <CardDescription>生成一次性绑定码并管理已授权的私聊用户。</CardDescription>
        </div>
        <Button
          disabled={!data?.configured || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          生成绑定码
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">开关</span>
              <StatusBadge status={data.enabled ? "enabled" : "disabled"} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">配置</span>
              <StatusBadge status={data.configured ? "healthy" : "unavailable"} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">运行</span>
              <StatusBadge status={data.status.running ? "running" : "disabled"} />
            </div>
          </div>
        ) : null}
        {!data?.configured ? (
          <Alert>
            <AlertTitle>管理 Bot 未配置</AlertTitle>
            <AlertDescription>
              请配置 TG_BOT_ADMIN_BOT_TOKEN，并设置 TG_BOT_BOT_ENABLED=true 后重启服务。
            </AlertDescription>
          </Alert>
        ) : null}
        {data?.codes.some((item) => item.status === "active") ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">当前绑定码</h3>
            {data.codes
              .filter((item) => item.status === "active")
              .map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  key={item.id}
                >
                  <div className="text-sm">
                    <span className="font-mono">末四位 · {item.hint}</span>
                    <span className="ml-3 text-muted-foreground">
                      有效至 {formatDate(item.expiresAt)}
                    </span>
                  </div>
                  <ConfirmAction
                    title="撤销绑定码？"
                    description="撤销后该绑定码立即失效，已绑定用户不受影响。"
                    triggerLabel="撤销"
                    actionLabel="确认撤销"
                    variant="destructive"
                    onConfirm={() => revokeCodeMutation.mutateAsync(item.id).then(() => undefined)}
                  />
                </div>
              ))}
          </div>
        ) : null}
        <Separator />
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium">已绑定用户</h3>
            <p className="text-sm text-muted-foreground">只有私聊用户可以使用管理 Bot。</p>
          </div>
          {data?.bindings.length ? (
            data.bindings.map((binding) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                key={binding.id}
              >
                <div className="text-sm">
                  <span className="font-medium">{bindingName(binding)}</span>
                  <span className="ml-3 text-muted-foreground">
                    绑定于 {formatDate(binding.boundAt)}
                  </span>
                </div>
                <ConfirmAction
                  title="解除该用户绑定？"
                  description="解除后该用户将无法继续查看或操作任务。"
                  triggerLabel="解除绑定"
                  actionLabel="确认解除"
                  variant="destructive"
                  onConfirm={() =>
                    revokeBindingMutation.mutateAsync(binding.id).then(() => undefined)
                  }
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">暂无已绑定用户。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
