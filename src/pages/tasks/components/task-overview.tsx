import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Task } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { TaskWorkflowEditor } from "./task-workflow-editor";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{value}</dd>
    </div>
  );
}

export function TaskOverview({ task }: { task: Task }) {
  const schedule =
    task.schedule.type === "fixed"
      ? `每天 ${task.schedule.time ?? "—"}`
      : `每天 ${task.schedule.start ?? "—"}–${task.schedule.end ?? "—"} 随机`;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>任务目标与调度配置。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4">
              <DetailRow label="Telegram 账号" value={task.account} />
              <Separator />
              <DetailRow label="目标聊天" value={task.target} />
              <Separator />
              <DetailRow label="执行计划" value={schedule} />
              <Separator />
              <DetailRow label="任务时区" value={task.schedule.timezone} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>运行状态</CardTitle>
            <CardDescription>时间默认按当前浏览器时区显示。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4">
              <DetailRow label="下次执行" value={formatDateTime(task.nextRunAt)} />
              <Separator />
              <DetailRow label="上次执行" value={formatDateTime(task.lastRunAt)} />
              <Separator />
              <DetailRow label="上次状态" value={task.lastStatus ?? "—"} />
              <Separator />
              <DetailRow label="更新时间" value={formatDateTime(task.updatedAt)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>执行工作流预览</CardTitle>
          <CardDescription>
            按当前配置展示实际的串行执行顺序，不会触发 Telegram 操作。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskWorkflowEditor
            steps={task.definition?.steps ?? []}
            run={task.run}
            readOnly
            onChange={() => undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
