import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiRequest } from "@/lib/api/client";
import type { Paginated, TaskRun } from "@/lib/api/types";
import { RunTable } from "./components/run-table";

export default function RunsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const query = useQuery({
    queryKey: ["runs", { page, status }],
    queryFn: () =>
      apiRequest<Paginated<TaskRun>>(
        `/api/runs?page=${page}&pageSize=25${status === "all" ? "" : `&status=${status}`}`,
      ),
    refetchInterval: status === "running" ? 5_000 : 30_000,
  });
  return (
    <>
      <PageHeader
        title="执行记录"
        description="查看每次计划或手动执行的结果、耗时、尝试次数和错误。"
        actions={
          <ToggleGroup
            value={[status]}
            onValueChange={(values) => {
              if (values[0]) {
                setStatus(values[0]);
                setPage(1);
              }
            }}
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="running">运行中</ToggleGroupItem>
            <ToggleGroupItem value="success">成功</ToggleGroupItem>
            <ToggleGroupItem value="failed">失败</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {query.isPending && !query.data ? <PageSkeleton /> : null}
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="flex flex-col gap-5">
          <RunTable runs={query.data.items} />
          <DataPagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </>
  );
}
