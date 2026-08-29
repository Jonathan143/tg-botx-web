import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { toast } from "@/components/ui/toast";
import type { Task } from "@/lib/api/types";

function notifyRunFinished(task: Task) {
  // Test runs intentionally leave the task's formal `lastStatus` unchanged.
  // Their terminal status is exposed through the current run progress instead.
  const status = task.run?.status ?? task.lastStatus;

  if (status === "success") {
    toast.add({ type: "success", title: "任务执行成功", timeout: 4_000 });
    return;
  }
  if (status === "canceled") {
    toast.add({ type: "warning", title: "任务执行已取消", timeout: 4_000 });
    return;
  }
  if (status === "skipped") {
    toast.add({ type: "warning", title: "任务执行已跳过", timeout: 4_000 });
    return;
  }
  toast.add({
    type: "error",
    title: "任务执行失败",
    description: task.run?.error ?? undefined,
    timeout: 6_000,
  });
}

export function useTaskEvents(taskId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!taskId) return;

    const source = new EventSource(`/api/tasks/${encodeURIComponent(taskId)}/events`, {
      withCredentials: true,
    });
    const handleTaskUpdated = (event: MessageEvent<string>) => {
      try {
        const task = JSON.parse(event.data) as Task;
        if (task.id === taskId) {
          const previousTask = queryClient.getQueryData<Task>(["task", taskId]);
          queryClient.setQueryData(["task", taskId], task);
          if (previousTask?.running && !task.running) {
            notifyRunFinished(task);
          }
        }
      } catch {
        // EventSource 会自行处理注释心跳；忽略无法解析的业务事件。
      }
    };

    source.addEventListener("task.updated", handleTaskUpdated as EventListener);
    return () => {
      source.removeEventListener("task.updated", handleTaskUpdated as EventListener);
      source.close();
    };
  }, [queryClient, taskId]);
}
