import { useQuery } from "@tanstack/react-query";
import { ActivityIcon, CheckCircle2Icon, ClipboardListIcon, PlayCircleIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiRequest } from "@/lib/api/client";
import type { DashboardResponse } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { HealthPanel } from "./components/health-panel";
import { MetricCard } from "./components/metric-card";
import { RecentRuns } from "./components/recent-runs";
import { SuccessChart } from "./components/success-chart";
import { UpcomingTasks } from "./components/upcoming-tasks";

export default function DashboardPage() {
  const [range, setRange] = useState("24h");
  const query = useQuery({
    queryKey: ["dashboard", range],
    queryFn: () => apiRequest<DashboardResponse>(`/api/dashboard?range=${range}`),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        title="仪表盘"
        description="查看调度服务健康状态、关键任务指标与近期执行情况。"
        actions={
          <ToggleGroup
            value={[range]}
            onValueChange={(values) => values[0] && setRange(values[0])}
            aria-label="统计时间范围"
          >
            <ToggleGroupItem value="24h">24 小时</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 天</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 天</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {query.isPending && !query.data ? <PageSkeleton /> : null}
      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="任务总数"
              value={query.data.stats.totalTasks}
              description={`${query.data.stats.enabledTasks} 个已启用`}
              icon={ClipboardListIcon}
            />
            <MetricCard
              title="运行中"
              value={query.data.stats.runningTasks}
              description="正在占用执行通道"
              icon={PlayCircleIcon}
            />
            <MetricCard
              title="执行成功率"
              value={formatPercent(query.data.stats.successRate)}
              description={`统计范围：${range}`}
              icon={CheckCircle2Icon}
            />
            <MetricCard
              title="失败执行"
              value={query.data.stats.failedRuns}
              description="建议及时查看错误详情"
              icon={ActivityIcon}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <SuccessChart data={query.data.statusBreakdown} />
            <HealthPanel health={query.data.health} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <RecentRuns runs={query.data.recentRuns} />
            <UpcomingTasks
              tasks={query.data.upcomingTasks}
              accountStatus={query.data.accountStatus}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
