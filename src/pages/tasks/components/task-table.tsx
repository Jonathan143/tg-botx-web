import { DownloadIcon, MoreHorizontalIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export function TaskTable({
  tasks,
  onToggle,
  onExport,
}: {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onExport: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState title="没有匹配的任务" description="调整筛选条件，或创建一个新的签到任务。" />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>任务</TableHead>
            <TableHead className="hidden md:table-cell">账号 / 目标</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="hidden lg:table-cell">下次执行</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <Link to={`/tasks/${task.id}`} className="font-medium hover:underline">
                  {task.name}
                </Link>
                <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground md:hidden">
                  {task.account} · {task.target}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex max-w-xs flex-col gap-1 text-sm">
                  <span>{task.account}</span>
                  <span className="truncate text-muted-foreground">{task.target}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge
                    status={task.archived ? "archived" : task.enabled ? "enabled" : "disabled"}
                  />
                  {task.running ? <StatusBadge status="running" /> : null}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDateTime(task.nextRunAt)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" aria-label={`操作 ${task.name}`} />}
                  >
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem render={<Link to={`/tasks/${task.id}`} />}>
                        查看详情
                      </DropdownMenuItem>
                      {!task.archived ? (
                        <DropdownMenuItem onClick={() => onToggle(task)}>
                          {task.enabled ? "停用任务" : "启用任务"}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => onExport(task)}>
                        <DownloadIcon />
                        导出 YAML
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
