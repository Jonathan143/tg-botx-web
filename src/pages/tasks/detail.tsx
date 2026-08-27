import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
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
