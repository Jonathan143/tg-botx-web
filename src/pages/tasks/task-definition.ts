import type { Task, TaskDefinition } from "@/lib/api/types";

export function definitionFromTask(task: Task): TaskDefinition {
  return (
    task.definition ?? {
      name: task.name,
      account: task.account,
      target: task.target,
      schedule: task.schedule,
      retry: { max_attempts: 3, backoff_seconds: [30, 60, 120] },
      steps: [],
      notifications: { failure: true, success: false },
      log_bot_response: false,
      log_condition_values: false,
      notify_bot_response: false,
    }
  );
}

export function cloneTaskDefinition(definition: TaskDefinition): TaskDefinition {
  return JSON.parse(JSON.stringify(definition)) as TaskDefinition;
}
