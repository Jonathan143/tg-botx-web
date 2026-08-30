import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account, Paginated } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { LoginAccountDialog } from "./components/login-account-dialog";
import { LogoutAccountDialog } from "./components/logout-account-dialog";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Paginated<Account> | Account[]>("/api/accounts"),
    refetchInterval: 30_000,
  });
  const accounts = Array.isArray(query.data) ? query.data : (query.data?.items ?? []);

  const syncAccountChats = async (account: Account) => {
    if (!account.active || syncingAccountId) return;
    setSyncingAccountId(account.id);
    try {
      const result = await apiRequest<{
        added: number;
        updated: number;
        removed: number;
        total: number;
      }>(`/api/accounts/${account.id}/chats/pull`, {
        method: "POST",
        body: jsonBody({}),
      });
      await queryClient.invalidateQueries({ queryKey: ["account-chats", account.id] });
      toast.add({
        type: "success",
        title: "聊天数据同步完成",
        description: `共 ${result.total} 个对话，新增 ${result.added} 个，更新 ${result.updated} 个，失效 ${result.removed} 个。`,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "聊天数据同步失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    } finally {
      setSyncingAccountId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Telegram 账号"
        description="管理用于签到任务的用户账号登录状态。手机号和验证码不会被持久化。"
        actions={<LoginAccountDialog onComplete={() => query.refetch()} />}
      />
      {query.isPending && !query.data ? <PageSkeleton /> : null}
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data && accounts.length === 0 ? (
        <EmptyState title="还没有 Telegram 账号" description="通过二维码或手机号登录第一个账号。" />
      ) : null}
      {accounts.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="truncate">{account.name}</CardTitle>
                    <CardDescription>{account.phoneMasked ?? "手机号已隐藏"}</CardDescription>
                  </div>
                  <StatusBadge status={account.active ? "active" : "inactive"} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">关联任务：</span>
                  {account.taskCount ?? 0}
                </p>
                <p>
                  <span className="text-muted-foreground">启用任务：</span>
                  {account.enabledTaskCount ?? 0}
                </p>
                <p>
                  <span className="text-muted-foreground">创建时间：</span>
                  {formatDateTime(account.createdAt)}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                {account.active ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={syncingAccountId !== null}
                      onClick={() => syncAccountChats(account)}
                    >
                      {syncingAccountId === account.id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <RefreshCwIcon className="size-3.5" />
                      )}
                      同步聊天数据
                    </Button>
                    <LogoutAccountDialog account={account} onComplete={() => query.refetch()} />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">可使用相同名称重新登录</span>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
