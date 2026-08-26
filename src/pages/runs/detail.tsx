import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/api/client";
import type { TaskRun } from "@/lib/api/types";
import { formatDateTime, formatDuration } from "@/lib/format";

export default function RunDetailPage() {
  const { runId } = useParams();
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => apiRequest<TaskRun>(`/api/runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (state) => (state.state.data?.status === "running" ? 5_000 : false),
  });
  if (!runId) return <Navigate to="/runs" replace />;
  return (
    <>
      {query.isPending && !query.data ? <PageSkeleton /> : null}
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <PageHeader
            title={query.data.taskName ?? "执行详情"}
            description={`执行记录 ${query.data.id}`}
            actions={
              <>
                <StatusBadge status={query.data.status} />
                <Button
                  variant="outline"
                  render={<Link to={`/tasks/${query.data.taskId}`} />}
                  nativeButton={false}
                >
                  查看任务
                </Button>
              </>
            }
          />
          <Card>
            <CardHeader>
              <CardTitle>执行时间线</CardTitle>
              <CardDescription>所有时间默认按当前浏览器时区显示，数据源仍为 UTC。</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">计划时间</dt>
                  <dd>{formatDateTime(query.data.plannedAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">开始时间</dt>
                  <dd>{formatDateTime(query.data.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">完成时间</dt>
                  <dd>{formatDateTime(query.data.finishedAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">耗时 / 尝试</dt>
                  <dd>
                    {formatDuration(query.data.startedAt, query.data.finishedAt)} ·{" "}
                    {query.data.attempts} 次
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {query.data.error ? (
            <Alert variant="destructive">
              <AlertTitle>执行错误</AlertTitle>
              <Separator className="my-2" />
              <AlertDescription>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs">
                  {query.data.error}
                </pre>
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : null}
    </>
  );
}
