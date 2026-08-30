import {
  CheckCircle2,
  Clock3,
  FlaskConical,
  GitBranch,
  Play,
  RotateCcw,
  Save,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import type { Task, TaskDefinition } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { TaskWorkflowEditor } from "./task-workflow-editor";

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-base font-semibold">{value}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:items-baseline">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{value}</dd>
    </div>
  );
}

export function TaskOverview({
  task,
  definition,
  workflowDirty = false,
  isSavingWorkflow = false,
  isTestingWorkflow = false,
  onStepsChange,
  onSaveWorkflow,
  onTestWorkflow,
}: {
  task: Task;
  definition: TaskDefinition;
  workflowDirty?: boolean;
  isSavingWorkflow?: boolean;
  isTestingWorkflow?: boolean;
  onStepsChange?: (steps: TaskDefinition["steps"]) => void;
  onSaveWorkflow?: () => void;
  onTestWorkflow?: () => void;
}) {
  const schedule =
    task.schedule.type === "fixed"
      ? `每天 ${task.schedule.time ?? "—"}`
      : `每天 ${task.schedule.start ?? "—"}–${task.schedule.end ?? "—"} 随机`;
  const stepCount = definition.steps.length;
  const lastStatus = task.lastStatus?.toLowerCase();
  const isSuccessful = lastStatus === "success" || lastStatus === "completed";

  return (
    <div className="flex flex-col gap-5 pt-6">
      <Card className="overflow-visible">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Play} label="工作流" value={`${stepCount} 个步骤`} detail="main 草稿" />
          <Stat
            icon={Clock3}
            label="下次执行"
            value={formatDateTime(task.nextRunAt)}
            detail={schedule}
          />
          <Stat
            icon={isSuccessful ? CheckCircle2 : RotateCcw}
            label="上次运行"
            value={task.lastStatus ?? "暂无记录"}
            detail={formatDateTime(task.lastRunAt)}
          />
          <Stat
            icon={GitBranch}
            label="正式版本"
            value={task.latestWorkflowVersion ? `v${task.latestWorkflowVersion}` : "未发布"}
            detail="发布后才会执行"
          />
          <Stat icon={Clock3} label="更新时间" value={formatDateTime(task.updatedAt)} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,0.8fr)]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1">
                <CardTitle>工作流</CardTitle>
                <CardDescription>
                  点击节点编辑步骤，拖拽调整顺序；任务元信息可在配置弹框中维护。
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={workflowDirty ? "outline" : "secondary"}>
                  {workflowDirty ? "未保存" : `${stepCount} steps`}
                </Badge>
                {onTestWorkflow ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isTestingWorkflow || workflowDirty}
                    onClick={onTestWorkflow}
                  >
                    {isTestingWorkflow ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <FlaskConical data-icon="inline-start" />
                    )}
                    测试工作流
                  </Button>
                ) : null}
                {onSaveWorkflow ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!workflowDirty || isSavingWorkflow}
                    onClick={onSaveWorkflow}
                  >
                    {isSavingWorkflow ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    保存工作流
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <TaskWorkflowEditor
              steps={definition.steps}
              run={task.run}
              readOnly={!onStepsChange}
              onChange={(steps) => onStepsChange?.(steps)}
            />
          </CardContent>
        </Card>

        <Card className="h-fit min-w-0">
          <CardHeader className="border-b">
            <CardTitle>任务信息</CardTitle>
            <CardDescription>运行环境与发布状态</CardDescription>
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
              <Separator />
              <DetailRow
                label="草稿状态"
                value={
                  task.latestWorkflowVersion
                    ? `main 草稿 · 已发布 v${task.latestWorkflowVersion}`
                    : "main 草稿 · 尚未发布"
                }
              />
            </dl>
            {task.workflowVersions && task.workflowVersions.length > 0 ? (
              <div className="mt-6 grid gap-2 border-t pt-5">
                <p className="text-xs font-medium text-muted-foreground">历史版本</p>
                <div className="flex flex-wrap gap-2">
                  {task.workflowVersions.map((version) => (
                    <Badge key={version.version} variant="outline">
                      v{version.version}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
