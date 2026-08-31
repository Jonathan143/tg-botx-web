import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";

import { DataPagination } from "@/components/data-pagination";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { toast } from "@/components/ui/toast";
import { apiRequest, downloadFromApi } from "@/lib/api/client";
import type { LogEntry, Paginated } from "@/lib/api/types";
import { LogFilters } from "./components/log-filters";
import { LogViewer } from "./components/log-viewer";

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [queryText, setQueryText] = useState("");
  const [level, setLevel] = useState("all");
  const [live, setLive] = useState(false);
  const [liveEntries, setLiveEntries] = useState<LogEntry[]>([]);
  const deferredQuery = useDeferredValue(queryText);
  const logsQuery = useQuery({
    queryKey: ["logs", { page, pageSize, level, query: deferredQuery }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (level !== "all") params.set("level", level);
      if (deferredQuery) params.set("query", deferredQuery);
      return apiRequest<Paginated<LogEntry>>(`/api/logs?${params}`);
    },
    enabled: !live,
  });

  useEffect(() => {
    if (!live) {
      setLiveEntries([]);
      return;
    }
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    if (deferredQuery) params.set("query", deferredQuery);
    const source = new EventSource(`/api/logs/stream?${params}`, { withCredentials: true });
    const handleLog = (event: MessageEvent<string>) => {
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLiveEntries((current) => [entry, ...current].slice(0, 200));
      } catch {
        /* 忽略无法解析的心跳消息 */
      }
    };
    source.addEventListener("log", handleLog as EventListener);
    source.onerror = () =>
      toast.add({
        type: "warning",
        title: "实时日志连接中断",
        description: "浏览器将自动尝试重连。",
      });
    return () => {
      source.removeEventListener("log", handleLog as EventListener);
      source.close();
    };
  }, [deferredQuery, level, live]);

  const entries = live ? liveEntries : (logsQuery.data?.items ?? []);
  return (
    <>
      <PageHeader
        title="运行日志"
        description="查看已脱敏的服务日志。实时追踪最多在浏览器保留 200 条。"
      />
      <LogFilters
        query={queryText}
        level={level}
        live={live}
        onQueryChange={(value) => {
          setQueryText(value);
          setPage(1);
        }}
        onLevelChange={(value) => {
          setLevel(value);
          setPage(1);
        }}
        onLiveChange={setLive}
        onDownload={() => downloadFromApi("/api/logs/download", "tg-bot-logs.zip")}
      />
      {!live && logsQuery.isPending && !logsQuery.data ? <PageSkeleton /> : null}
      {!live && logsQuery.isError && !logsQuery.data ? (
        <ErrorState error={logsQuery.error} onRetry={() => logsQuery.refetch()} />
      ) : null}
      {live || logsQuery.data ? (
        <div className="flex flex-col gap-5">
          <LogViewer entries={entries} />
          {!live && logsQuery.data ? (
            <DataPagination
              page={logsQuery.data.page}
              pageSize={logsQuery.data.pageSize}
              total={logsQuery.data.total}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
