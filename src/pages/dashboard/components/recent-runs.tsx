import { Link } from "react-router-dom";

import { EmptyState } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskRun } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export function RecentRuns({ runs }: { runs: TaskRun[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>最近执行</CardTitle>
          <CardDescription>优先关注失败与仍在运行的任务。</CardDescription>
        </div>
        <Button variant="outline" size="sm" render={<Link to="/runs" />} nativeButton={false}>
          查看全部
        </Button>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <EmptyState title="暂无执行记录" description="任务首次运行后会在这里显示。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden md:table-cell">开始时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.slice(0, 8).map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/runs/${run.id}`}>
                      {run.taskName ?? run.taskId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDateTime(run.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
