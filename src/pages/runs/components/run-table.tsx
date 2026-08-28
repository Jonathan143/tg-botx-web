import { Link } from "react-router-dom";

import { EmptyState } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskRun } from "@/lib/api/types";
import { formatDateTime, formatDuration } from "@/lib/format";

export function RunTable({ runs }: { runs: TaskRun[] }) {
  if (runs.length === 0)
    return <EmptyState title="没有执行记录" description="调整筛选条件，或等待任务运行。" />;
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>任务</TableHead>
            <TableHead>工作流版本</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="hidden md:table-cell">开始时间</TableHead>
            <TableHead className="hidden lg:table-cell">耗时</TableHead>
            <TableHead className="hidden lg:table-cell">尝试</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link to={`/runs/${run.id}`} className="font-medium hover:underline">
                  {run.taskName ?? run.taskId}
                </Link>
                {run.error ? (
                  <p className="mt-1 max-w-sm truncate text-xs text-destructive">{run.error}</p>
                ) : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {run.runKind === "test"
                  ? "测试（草稿）"
                  : run.workflowVersion
                    ? `v${run.workflowVersion}`
                    : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(run.startedAt)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDuration(run.startedAt, run.finishedAt)}
              </TableCell>
              <TableCell className="hidden tabular-nums lg:table-cell">{run.attempts}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
