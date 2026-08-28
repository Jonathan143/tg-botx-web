import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useTaskEvents } from "@/hooks/use-task-events";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account, Paginated, Task, TaskDefinition } from "@/lib/api/types";
import { TaskActions } from "./components/task-actions";
import { TaskForm } from "./components/task-form";
import { TaskOverview } from "./components/task-overview";

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const queryClient = useQueryClient();
  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => apiRequest<Task>(`/api/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
  useTaskEvents(taskQuery.data?.id === taskId && taskQuery.data?.running ? taskId : undefined);
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Paginated<Account> | Account[]>("/api/accounts"),
  });
  const accounts = Array.isArray(accountsQuery.data)
    ? accountsQuery.data
    : (accountsQuery.data?.items ?? []);
  const updateMutation = useMutation({
    mutationFn: async (definition: TaskDefinition) => {
      await apiRequest("/api/tasks/validate", { method: "POST", body: jsonBody({ definition }) });
      return apiRequest<Task>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: jsonBody({ definition }),
      });
    },
    onSuccess: (task) => {
      queryClient.setQueryData(["task", taskId], task);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.add({ type: "success", title: "任务配置已保存" });
    },
  });
  const publishMutation = useMutation({
    mutationFn: () =>
      apiRequest<Task>(`/api/tasks/${taskId}/publish`, {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: (task) => {
      queryClient.setQueryData(["task", taskId], task);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.add({
        type: "success",
        title: task.latestWorkflowVersion
          ? `工作流已发布 v${task.latestWorkflowVersion}`
          : "工作流已发布",
      });
    },
    onError: (error) => toast.add({ type: "error", title: "发布失败", description: error.message }),
  });
  const testMutation = useMutation({
    mutationFn: (definition: TaskDefinition) =>
      apiRequest<Task>(`/api/tasks/${taskId}/test`, {
        method: "POST",
        body: jsonBody({ definition }),
      }),
    onSuccess: (task) => {
      queryClient.setQueryData(["task", taskId], task);
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      toast.add({ type: "success", title: "测试工作流已加入执行队列" });
    },
  });
  if (!taskId) return <Navigate to="/tasks" replace />;

  return (
    <>
      {taskQuery.isPending && !taskQuery.data ? <PageSkeleton /> : null}
      {taskQuery.isError && !taskQuery.data ? (
        <ErrorState error={taskQuery.error} onRetry={() => taskQuery.refetch()} />
      ) : null}
      {taskQuery.data ? (
        <>
          <PageHeader
            title={taskQuery.data.name}
            description={`${taskQuery.data.account} · ${taskQuery.data.target}`}
            actions={
              <>
                <StatusBadge
                  status={
                    taskQuery.data.archived
                      ? "archived"
                      : taskQuery.data.enabled
                        ? "enabled"
                        : "disabled"
                  }
                />
                <TaskActions task={taskQuery.data} />
              </>
            }
          />
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="configuration">配置</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-5">
              <TaskOverview task={taskQuery.data} />
            </TabsContent>
            <TabsContent value="configuration" className="pt-5">
              <Card>
                <div className="flex flex-col gap-3 border-b px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">工作流版本</p>
                    <p className="text-sm text-muted-foreground">
                      {taskQuery.data.latestWorkflowVersion
                        ? `当前正式版本 v${taskQuery.data.latestWorkflowVersion}；编辑内容保存在 main 草稿。`
                        : "尚未发布正式版本；请先发布后再启用任务。"}
                    </p>
                    {taskQuery.data.workflowVersions &&
                    taskQuery.data.workflowVersions.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        历史版本：
                        {taskQuery.data.workflowVersions
                          .map((version) => ` v${version.version}`)
                          .join("、")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending || taskQuery.data.archived}
                  >
                    {publishMutation.isPending ? "发布中…" : "发布 main"}
                  </Button>
                </div>
                <CardContent>
                  <TaskForm
                    accounts={accounts}
                    accountsLoading={accountsQuery.isPending}
                    accountsError={accountsQuery.isError}
                    initialValue={
                      taskQuery.data.definition ??
                      ({
                        name: taskQuery.data.name,
                        account: taskQuery.data.account,
                        target: taskQuery.data.target,
                        schedule: taskQuery.data.schedule,
                        retry: { maxAttempts: 3, backoffSeconds: [30, 60, 120] },
                        steps: [],
                        notifications: { failure: true, success: false },
                      } satisfies TaskDefinition)
                    }
                    submitLabel="保存配置"
                    isSubmitting={updateMutation.isPending}
                    isTesting={testMutation.isPending}
                    onTest={async (definition) => {
                      await testMutation.mutateAsync(definition);
                    }}
                    onSubmit={async (definition) => {
                      try {
                        await updateMutation.mutateAsync(definition);
                      } catch (error) {
                        throw error instanceof Error ? error : new Error("保存失败");
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </>
  );
}
