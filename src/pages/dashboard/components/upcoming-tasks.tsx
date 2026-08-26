import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DashboardResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export function UpcomingTasks({
  tasks,
  accountStatus,
}: {
  tasks: DashboardResponse["upcomingTasks"];
  accountStatus: DashboardResponse["accountStatus"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>即将执行</CardTitle>
        <CardDescription>按下一次计划时间排序，并附账号状态分布。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {accountStatus.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="text-sm text-muted-foreground">
                {item.label} {item.count}
              </span>
            </div>
          ))}
        </div>
        <Separator />
        {tasks.length ? (
          <div className="flex flex-col gap-4">
            {tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to={`/tasks/${task.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {task.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.account} · {task.target}
                  </p>
                </div>
                <time
                  className="shrink-0 text-right text-xs text-muted-foreground"
                  dateTime={task.nextRunAt ?? undefined}
                >
                  {formatDateTime(task.nextRunAt)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">当前没有已排期任务。</p>
        )}
      </CardContent>
    </Card>
  );
}
