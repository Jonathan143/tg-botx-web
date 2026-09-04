import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account, Paginated, Task, TaskDefinition } from "@/lib/api/types";
import { TaskForm } from "./components/task-form";
import { definitionFromTask, cloneTaskDefinition } from "./task-definition";

type NewTaskLocationState = {
  definition?: TaskDefinition;
  sourceTaskName?: string;
};

export default function NewTaskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const copyFrom = new URLSearchParams(location.search).get("copyFrom");
  const locationState = (location.state ?? null) as NewTaskLocationState | null;
  const stateDefinition = locationState?.definition;
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Paginated<Account> | Account[]>("/api/accounts"),
  });
  const accounts = Array.isArray(accountsQuery.data)
    ? accountsQuery.data
    : (accountsQuery.data?.items ?? []);
  const sourceTaskQuery = useQuery({
    queryKey: ["task", copyFrom],
    queryFn: () => apiRequest<Task>(`/api/tasks/${encodeURIComponent(copyFrom ?? "")}`),
    enabled: Boolean(copyFrom && !stateDefinition),
  });
  const sourceTask = sourceTaskQuery.data;
  const initialValue = useMemo(
    () =>
      stateDefinition || sourceTask
        ? cloneTaskDefinition(stateDefinition ?? definitionFromTask(sourceTask as Task))
        : undefined,
    [sourceTask, stateDefinition],
  );
  const mutation = useMutation({
    mutationFn: async (definition: TaskDefinition) => {
      await apiRequest("/api/tasks/validate", { method: "POST", body: jsonBody({ definition }) });
      return apiRequest<Task>("/api/tasks", { method: "POST", body: jsonBody({ definition }) });
    },
  });

  return (
    <>
      <PageHeader
        title="新建任务"
        description={
          stateDefinition || sourceTask
            ? `已回显「${locationState?.sourceTaskName ?? sourceTask?.name ?? stateDefinition?.name}」的配置，可在此基础上调整后创建新任务。`
            : "使用表单快速配置，或切换到 YAML 模式录入完整 TaskDefinition。"
        }
      />
      <Card>
        <CardContent>
          {copyFrom && !stateDefinition && sourceTaskQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">正在加载任务配置…</p>
          ) : sourceTaskQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              无法加载要复制的任务配置，请返回任务列表后重试。
            </p>
          ) : (
            <TaskForm
              initialValue={initialValue}
              accounts={accounts}
              accountsLoading={accountsQuery.isPending}
              accountsError={accountsQuery.isError}
              submitLabel="创建任务"
              isSubmitting={mutation.isPending}
              onSubmit={async (definition) => {
                try {
                  const task = await mutation.mutateAsync(definition);
                  toast.add({ type: "success", title: "任务已创建" });
                  navigate(`/tasks/${task.id}`);
                } catch (error) {
                  throw error instanceof Error ? error : new Error("创建失败");
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
