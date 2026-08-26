import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiRequest } from "@/lib/api/client";
import type { Account, Paginated } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { LoginAccountDialog } from "./components/login-account-dialog";
import { LogoutAccountDialog } from "./components/logout-account-dialog";

export default function AccountsPage() {
  const query = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Paginated<Account> | Account[]>("/api/accounts"),
    refetchInterval: 30_000,
  });
  const accounts = Array.isArray(query.data) ? query.data : (query.data?.items ?? []);
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
              <CardFooter>
                {account.active ? (
                  <LogoutAccountDialog account={account} onComplete={() => query.refetch()} />
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
