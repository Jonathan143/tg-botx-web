import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmAction } from "@/components/confirm-action";
import { DataPagination } from "@/components/data-pagination";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotBindingCodesResponse, BotBindingsResponse } from "@/lib/api/types";

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
  const [quantity, setQuantity] = useState(1);
  const [ttlDays, setTtlDays] = useState<number | null>(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [generated, setGenerated] = useState<Array<{ code: string; expiresAt: string | null }>>([]);
  const [activeTab, setActiveTab] = useState("codes");
  const [codesPage, setCodesPage] = useState(1);
  const [bindingsPage, setBindingsPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();
  const codesQuery = useQuery({
    queryKey: ["bot-binding-codes", codesPage],
    enabled: activeTab === "codes",
    queryFn: () =>
      apiRequest<BotBindingCodesResponse>(
        `/api/bot/binding-codes?page=${codesPage}&pageSize=${pageSize}`,
      ),
  });
  const bindingsQuery = useQuery({
    queryKey: ["bot-bindings", bindingsPage],
    enabled: activeTab === "bindings",
    queryFn: () =>
      apiRequest<BotBindingsResponse>(
        `/api/bot/bindings?page=${bindingsPage}&pageSize=${pageSize}`,
      ),
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest<{ codes: Array<{ code: string; expiresAt: string | null }> }>(
          "/api/bot/binding-codes/batch",
          {
            method: "POST",
            body: jsonBody({ role: "user", quantity, ttlDays }),
          },
        );
      } catch (error) {
        if (quantity === 1 && (error as { status?: number }).status === 404) {
          const legacy = await apiRequest<{ code: string; expiresAt: string | null }>(
            "/api/bot/bindings",
            { method: "POST", body: jsonBody({}) },
          );
          return { codes: [{ code: legacy.code, expiresAt: legacy.expiresAt }] };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bot-binding-codes"] });
      setGenerated(result.codes);
      setConfigOpen(false);
      toast.add({
        type: "success",
        title: "绑定码已生成",
        description: "请立即复制并发送给需要绑定的用户。",
      });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "生成绑定码失败", description: error.message }),
  });
  const revokeCodeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bot/binding-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-binding-codes"] }),
    onError: (error) =>
      toast.add({ type: "error", title: "撤销绑定码失败", description: error.message }),
  });
  const revokeBindingMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bot/bindings/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-bindings"] }),
    onError: (error) =>
      toast.add({ type: "error", title: "解除绑定失败", description: error.message }),
  });

  const codesData = codesQuery.data;
  const bindingsData = bindingsQuery.data;
  const codesPagination = codesData?.codesPagination ?? { page: codesPage, pageSize, total: 0 };
  const bindingsPagination = bindingsData?.bindingsPagination ?? {
    page: bindingsPage,
    pageSize,
    total: 0,
  };
  const statusData = codesData ?? bindingsData;
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Telegram 管理 Bot</CardTitle>
          <CardDescription>生成一次性绑定码并管理已授权的私聊用户。</CardDescription>
        </div>
        <Button
          disabled={!statusData?.configured || createMutation.isPending}
          onClick={() => setConfigOpen(true)}
        >
          批量生成
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {statusData ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">运行开关</span>
                <StatusBadge status={statusData.enabled ? "enabled" : "disabled"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">控制管理 Bot 是否轮询 Telegram</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">服务配置</span>
                <StatusBadge status={statusData.configured ? "healthy" : "unavailable"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Token 与运行参数配置状态</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">当前运行</span>
                <StatusBadge status={statusData.status.running ? "running" : "disabled"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {statusData.status.lastError ?? "最近一次轮询状态正常"}
              </p>
            </div>
          </div>
        ) : null}
        {!statusData?.configured ? (
          <Alert>
            <AlertTitle>管理 Bot 未配置</AlertTitle>
            <AlertDescription>
              请配置 TG_BOT_ADMIN_BOT_TOKEN，并设置 TG_BOT_BOT_ENABLED=true 后重启服务。
            </AlertDescription>
          </Alert>
        ) : null}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="codes">绑定码 ({codesPagination.total})</TabsTrigger>
            <TabsTrigger value="bindings">已绑定用户 ({bindingsPagination.total})</TabsTrigger>
          </TabsList>
          <TabsContent value="codes" className="pt-4">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-medium">绑定码</h3>
                <p className="text-sm text-muted-foreground">
                  绑定码仅能使用一次，过期或撤销后将立即失效。
                </p>
              </div>
              {codesData?.codes.length ? (
                codesData.codes.map((item) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    key={item.id}
                  >
                    <div className="text-sm">
                      <span className="font-mono">末四位 · {item.hint}</span>
                      <span className="ml-3 text-muted-foreground">
                        {item.role === "admin" ? "管理员" : "普通用户"}
                      </span>
                      <span className="ml-3 text-muted-foreground">
                        {item.status === "active"
                          ? `有效至 ${formatDate(item.expiresAt)}`
                          : item.status === "used"
                            ? "已使用"
                            : item.status === "revoked"
                              ? "已撤销"
                              : "已过期"}
                      </span>
                    </div>
                    {item.status === "active" ? (
                      <ConfirmAction
                        title="撤销绑定码？"
                        description="撤销后该绑定码立即失效，已绑定用户不受影响。"
                        triggerLabel="撤销"
                        actionLabel="确认撤销"
                        variant="destructive"
                        onConfirm={() =>
                          revokeCodeMutation.mutateAsync(item.id).then(() => undefined)
                        }
                      />
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无绑定码。</p>
              )}
              {codesData ? (
                <DataPagination
                  page={codesPagination.page}
                  pageSize={codesPagination.pageSize}
                  total={codesPagination.total}
                  onPageChange={setCodesPage}
                />
              ) : null}
            </div>
          </TabsContent>
          <TabsContent value="bindings" className="pt-4">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-medium">已绑定用户</h3>
                <p className="text-sm text-muted-foreground">
                  只有私聊用户可以使用管理 Bot，解绑后可重新绑定。
                </p>
              </div>
              {bindingsData?.bindings.length ? (
                bindingsData.bindings.map((binding) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    key={binding.id}
                  >
                    <div className="text-sm">
                      <span className="font-medium">{bindingName(binding)}</span>
                      <span className="ml-3 text-muted-foreground">
                        {binding.role === "admin" ? "管理员" : "普通用户"}
                      </span>
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
              {bindingsData ? (
                <DataPagination
                  page={bindingsPagination.page}
                  pageSize={bindingsPagination.pageSize}
                  total={bindingsPagination.total}
                  onPageChange={setBindingsPage}
                />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
        <Dialog
          open={configOpen}
          onOpenChange={(open) => !createMutation.isPending && setConfigOpen(open)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>批量生成绑定码</DialogTitle>
              <DialogDescription>配置生成数量和有效期，确认后立即生成。</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                生成数量
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                有效期
                <select
                  className="h-9 rounded-lg border bg-transparent px-2 text-sm"
                  value={ttlDays === null ? "永久" : ttlDays}
                  onChange={(event) =>
                    setTtlDays(event.target.value === "永久" ? null : Number(event.target.value))
                  }
                >
                  <option value={1}>1 天</option>
                  <option value={7}>7 天</option>
                  <option value={30}>30 天</option>
                  <option value="永久">永久</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => setConfigOpen(false)}
              >
                取消
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                {createMutation.isPending ? "生成中…" : "确认生成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={generated.length > 0} onOpenChange={(open) => !open && setGenerated([])}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>绑定码已生成</DialogTitle>
              <DialogDescription>明文仅显示本次，请及时复制保存。</DialogDescription>
            </DialogHeader>
            <div className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 font-mono text-sm">
              {generated.map((item) => (
                <div className="flex items-center justify-between gap-2 py-1" key={item.code}>
                  <span>
                    {item.code}{" "}
                    <span className="font-sans text-muted-foreground">
                      （{item.expiresAt ? formatDate(item.expiresAt) : "永久"}）
                    </span>
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => navigator.clipboard?.writeText(item.code)}
                  >
                    复制
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard?.writeText(generated.map((item) => item.code).join("\n"))
                }
              >
                复制全部
              </Button>
              <Button
                onClick={() => {
                  const blob = new Blob([generated.map((item) => item.code).join("\n")], {
                    type: "text/plain",
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = "binding-codes.txt";
                  anchor.click();
                  URL.revokeObjectURL(url);
                  setGenerated([]);
                }}
              >
                我已保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
