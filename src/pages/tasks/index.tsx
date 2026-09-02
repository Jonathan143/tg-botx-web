import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";

import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiRequest, downloadFromApi, jsonBody } from "@/lib/api/client";
import type { Paginated, Task } from "@/lib/api/types";
import { ImportTaskDialog } from "./components/import-task-dialog";
import { TaskFilters } from "./components/task-filters";
import { TaskTable } from "./components/task-table";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const tasksQuery = useQuery({
    queryKey: ["tasks", { page, search: deferredSearch, status }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (deferredSearch) params.set("search", deferredSearch);
      if (status === "enabled") params.set("enabled", "true");
      if (status === "disabled") params.set("enabled", "false");
      if (status === "archived") params.set("includeArchived", "true");
      return apiRequest<Paginated<Task>>(`/api/tasks?${params}`);
    },
  });
  const toggleMutation = useMutation({
    mutationFn: (task: Task) =>
      apiRequest(`/api/tasks/${task.id}/${task.enabled ? "disable" : "enable"}`, {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.add({ type: "success", title: "任务状态已更新" });
    },
    onError: (error) => toast.add({ type: "error", title: "操作失败", description: error.message }),
  });
  const skipNextMutation = useMutation({
    mutationFn: (task: Task) =>
      apiRequest(`/api/tasks/${task.id}/skip-next`, {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.add({ type: "success", title: "已跳过下次运行" });
    },
    onError: (error) => toast.add({ type: "error", title: "操作失败", description: error.message }),
  });

  return (
    <>
      <PageHeader
        title="任务"
        description="创建、调度和维护签到任务；复杂配置可使用 YAML 模式。"
        actions={
          <>
            <ImportTaskDialog
              onImported={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
            />
            <Button render={<Link to="/tasks/new" />} nativeButton={false}>
              <PlusIcon data-icon="inline-start" />
              新建任务
            </Button>
          </>
        }
      />
      <TaskFilters
        query={search}
        status={status}
        onQueryChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      {tasksQuery.isPending && !tasksQuery.data ? <PageSkeleton /> : null}
      {tasksQuery.isError && !tasksQuery.data ? (
        <ErrorState error={tasksQuery.error} onRetry={() => tasksQuery.refetch()} />
      ) : null}
      {tasksQuery.data ? (
        <div className="flex flex-col gap-5">
          <TaskTable
            tasks={
              status === "archived"
                ? tasksQuery.data.items.filter((task) => task.archived)
                : tasksQuery.data.items
            }
            onToggle={(task) => toggleMutation.mutate(task)}
            onSkipNext={(task) => skipNextMutation.mutate(task)}
            onExport={(task) =>
              downloadFromApi(`/api/tasks/${task.id}/export`, `${task.name}.yaml`)
            }
          />
          <DataPagination
            page={tasksQuery.data.page}
            pageSize={tasksQuery.data.pageSize}
            total={tasksQuery.data.total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </>
  );
}
