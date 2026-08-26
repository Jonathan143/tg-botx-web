import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";

export function TaskActions({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: string) =>
      apiRequest(`/api/tasks/${task.id}/${action}`, { method: "POST", body: jsonBody({}) }),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.add({ type: "success", title: action === "run" ? "任务已加入执行队列" : "任务已更新" });
    },
    onError: (error) => toast.add({ type: "error", title: "操作失败", description: error.message }),
  });
  const run = (action: string) => mutation.mutateAsync(action).then(() => undefined);

  return (
    <div className="flex flex-wrap gap-2">
      {task.archived ? (
        <Button variant="outline" onClick={() => mutation.mutate("restore")}>
          恢复任务
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={() => mutation.mutate(task.enabled ? "disable" : "enable")}
          >
            {task.enabled ? "停用" : "启用"}
          </Button>
          {task.running ? (
            <ConfirmAction
              title="取消当前执行？"
              description="只取消当前运行实例，不会停用未来调度。"
              actionLabel="确认取消"
              triggerLabel="取消执行"
              variant="destructive"
              onConfirm={() => run("cancel")}
            />
          ) : (
            <ConfirmAction
              title="立即执行任务？"
              description="这会向真实 Telegram 目标发送消息，并占用当前账号与目标的执行通道。"
              actionLabel="立即执行"
              triggerLabel="手动执行"
              onConfirm={() => run("run")}
            />
          )}
          <ConfirmAction
            title="归档任务？"
            description="任务会先停用并从未来调度中移除，之后仍可恢复。"
            actionLabel="归档"
            triggerLabel="归档"
            variant="destructive"
            onConfirm={() => run("archive")}
          />
        </>
      )}
    </div>
  );
}
