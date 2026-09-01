import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useTaskEvents } from "@/hooks/use-task-events";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account, Paginated, Task, TaskDefinition } from "@/lib/api/types";
import { TaskActions } from "./components/task-actions";
import { TaskForm } from "./components/task-form";
import { TaskOverview } from "./components/task-overview";

function definitionFromTask(task: Task): TaskDefinition {
  return (
    task.definition ?? {
      name: task.name,
      account: task.account,
      target: task.target,
      schedule: task.schedule,
      retry: { max_attempts: 3, backoff_seconds: [30, 60, 120] },
      steps: [],
      notifications: { failure: true, success: false },
      log_bot_response: false,
      notify_bot_response: false,
    }
  );
}

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const [configOpen, setConfigOpen] = useState(false);
  const [workflowDraft, setWorkflowDraft] = useState<TaskDefinition | null>(null);
  const [workflowDirty, setWorkflowDirty] = useState(false);
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
  const savedDefinition = useMemo(
    () => (taskQuery.data ? definitionFromTask(taskQuery.data) : null),
    [taskQuery.data],
  );
  useEffect(() => {
    if (!workflowDirty && savedDefinition) setWorkflowDraft(savedDefinition);
  }, [savedDefinition, workflowDirty]);
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
      setWorkflowDraft(definitionFromTask(task));
      setWorkflowDirty(false);
      setConfigOpen(false);
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
  const activeDefinition = workflowDraft ?? savedDefinition;
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
                <Button type="button" variant="outline" onClick={() => setConfigOpen(true)}>
                  编辑配置
                </Button>
                <Button
                  type="button"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending || taskQuery.data.archived || workflowDirty}
                >
                  {publishMutation.isPending
                    ? "发布中…"
                    : workflowDirty
                      ? "请先保存工作流"
                      : "发布 main"}
                </Button>
              </>
            }
          />
          {activeDefinition ? (
            <TaskOverview
              task={taskQuery.data}
              definition={activeDefinition}
              workflowDirty={workflowDirty}
              isSavingWorkflow={updateMutation.isPending}
              isTestingWorkflow={testMutation.isPending}
              onStepsChange={(steps) => {
                setWorkflowDraft((current) => ({ ...(current ?? activeDefinition), steps }));
                setWorkflowDirty(true);
              }}
              onSaveWorkflow={() => {
                if (!workflowDraft) return;
                updateMutation.mutate(workflowDraft);
              }}
              onTestWorkflow={() => {
                if (!activeDefinition) return;
                testMutation.mutate(activeDefinition);
              }}
            />
          ) : null}
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
              <DialogHeader className="shrink-0 border-b px-6 py-5">
                <DialogTitle>任务配置</DialogTitle>
                <DialogDescription>
                  调整任务信息、执行计划、重试和通知；工作流步骤请直接在主视图编辑。
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <TaskForm
                  taskId={taskId}
                  accounts={accounts}
                  accountsLoading={accountsQuery.isPending}
                  accountsError={accountsQuery.isError}
                  initialValue={activeDefinition ?? definitionFromTask(taskQuery.data)}
                  submitLabel="保存配置"
                  isSubmitting={updateMutation.isPending}
                  isTesting={testMutation.isPending}
                  run={taskQuery.data.run}
                  onSubmit={async (definition) => {
                    try {
                      await updateMutation.mutateAsync(definition);
                    } catch (error) {
                      throw error instanceof Error ? error : new Error("保存失败");
                    }
                  }}
                  onCancel={() => setConfigOpen(false)}
                  showWorkflow={false}
                  formId="task-config-form"
                  hideFooter
                />
              </div>
              <div className="shrink-0 border-t bg-popover px-6 py-4">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfigOpen(false)}
                    disabled={updateMutation.isPending || testMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    form="task-config-form"
                    disabled={updateMutation.isPending || testMutation.isPending}
                  >
                    {updateMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                    {updateMutation.isPending ? "保存中…" : "保存配置"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
