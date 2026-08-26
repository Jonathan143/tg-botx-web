import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account, Paginated, Task, TaskDefinition } from "@/lib/api/types";
import { TaskForm } from "./components/task-form";

export default function NewTaskPage() {
  const navigate = useNavigate();
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiRequest<Paginated<Account> | Account[]>("/api/accounts"),
  });
  const accounts = Array.isArray(accountsQuery.data)
    ? accountsQuery.data
    : (accountsQuery.data?.items ?? []);
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
        description="使用表单快速配置，或切换到 YAML 模式录入完整 TaskDefinition。"
      />
      <Card>
        <CardContent>
          <TaskForm
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
        </CardContent>
      </Card>
    </>
  );
}
