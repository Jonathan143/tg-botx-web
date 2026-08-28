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
import type { LogEntry, Task, TaskRun, TaskRunLog } from "@/lib/api/types";
import { formatDateTime, formatDuration } from "@/lib/format";
import { TaskWorkflowEditor } from "../tasks/components/task-workflow-editor";

export default function RunDetailPage() {
  const { runId } = useParams();
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => apiRequest<TaskRun>(`/api/runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (state) => (state.state.data?.status === "running" ? 5_000 : false),
  });
  const taskQuery = useQuery({
    queryKey: ["task", query.data?.taskId],
    queryFn: () => apiRequest<Task>(`/api/tasks/${query.data?.taskId}`),
    enabled: Boolean(query.data?.taskId),
  });
  const logsQuery = useQuery({
    queryKey: ["run-logs", query.data?.id, query.data?.startedAt, query.data?.finishedAt],
    queryFn: () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        query: query.data?.taskId ?? "",
      });
      if (query.data?.startedAt) params.set("from", query.data.startedAt);
      if (query.data?.finishedAt) params.set("to", query.data.finishedAt);
      return apiRequest<{ items: LogEntry[] }>(`/api/logs?${params}`);
    },
    enabled: Boolean(query.data?.taskId),
    refetchInterval: query.data?.status === "running" ? 5_000 : false,
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
                <div>
                  <dt className="text-sm text-muted-foreground">工作流版本</dt>
                  <dd>
                    {query.data.runKind === "test"
                      ? "测试（草稿）"
                      : query.data.workflowVersion
                        ? `v${query.data.workflowVersion}`
                        : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>执行工作流</CardTitle>
              <CardDescription>
                点击节点查看状态、错误信息、机器人回复和该节点的运行日志。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {query.data.workflow ? (
                <TaskWorkflowEditor
                  steps={query.data.workflow.steps}
                  run={
                    query.data.progress ??
                    (taskQuery.data?.run?.id === query.data.id ? taskQuery.data.run : null)
                  }
                  runLogs={query.data.progress?.logs}
                  readOnly
                  onChange={() => undefined}
                />
              ) : taskQuery.isPending ? (
                <p className="text-sm text-muted-foreground">正在加载工作流版本…</p>
              ) : (
                <p className="text-sm text-destructive">
                  {query.data.workflowError ??
                    "工作流版本数据不可用，无法回退到当前 main；请检查该版本记录。"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>运行日志</CardTitle>
              <CardDescription>按本次执行的任务和时间范围筛选，日志内容已脱敏。</CardDescription>
            </CardHeader>
            <CardContent>
              <RunLogs
                entries={logsQuery.data?.items ?? []}
                progressLogs={query.data.progress?.logs ?? []}
              />
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

function RunLogs({ entries, progressLogs }: { entries: LogEntry[]; progressLogs: TaskRunLog[] }) {
  const logs = entries.length > 0 ? entries : progressLogs;
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无本次执行的运行日志。</p>;
  }
  return (
    <div className="max-h-80 overflow-auto rounded-lg border font-mono text-xs">
      {logs.map((entry) => (
        <div
          key={`${entry.timestamp}-${entry.level}-${entry.message}`}
          className="grid gap-2 border-b px-3 py-2 last:border-b-0 md:grid-cols-[10.5rem_5rem_1fr]"
        >
          <time
            className="whitespace-nowrap text-muted-foreground"
            dateTime={entry.timestamp ?? undefined}
          >
            {formatDateTime(entry.timestamp)}
          </time>
          <span className="text-muted-foreground">{entry.level ?? "INFO"}</span>
          <p className="whitespace-pre-wrap break-words">
            {"stepIndex" in entry && entry.stepIndex !== null && entry.stepIndex !== undefined
              ? `步骤 ${entry.stepIndex + 1}：${entry.message}`
              : entry.message}
          </p>
        </div>
      ))}
    </div>
  );
}
