import type { WorkflowStep } from "@/lib/workflow-condition";

export const MAX_MESSAGES = 1000;
export const MAX_MESSAGE_LENGTH = 4096;

export type MessageGroupSummary = {
  id: string;
  name: string;
  messageCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type MessageGroup = MessageGroupSummary & { messages: string[] };
export type MessageGroupInput = { name: string; messages: string[] };

export function validateMessageText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "消息不能为空或仅包含空白字符。";
  if (value.length > MAX_MESSAGE_LENGTH) return "单条消息最多 4096 个 UTF-16 字符单位。";
  // Telegram limits UTF-16 units; reject lone surrogates before JSON transport.
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return "消息包含无效的 Unicode 字符。";
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return "消息包含无效的 Unicode 字符。";
  }
  return null;
}

export function validateMessageList(values: unknown, allowEmpty = false): string[] {
  if (!Array.isArray(values)) return ["消息数据必须是数组。"];
  if (!allowEmpty && values.length === 0) return ["请至少添加一条随机消息。"];
  if (values.length > MAX_MESSAGES) return ["每组最多 1000 条消息。"];
  return values.flatMap((value, index) => {
    const issue = validateMessageText(value);
    return issue ? [`第 ${index + 1} 条：${issue}`] : [];
  });
}

export function validateSendMessageStep(
  step: WorkflowStep,
  variables?: ReadonlySet<string>,
): string[] {
  if (step.type !== "send_message") return [];
  const issues: string[] = [];
  const mode = step.message_mode === undefined ? "fixed" : step.message_mode;
  const source = step.random_source === undefined ? "manual" : step.random_source;
  let candidates: unknown[] = [];
  if (mode === "fixed") {
    const issue = validateMessageText(step.text);
    if (issue) issues.push(issue);
    candidates = [step.text];
    if (step.messages != null || step.message_group_id != null || source !== "manual") {
      issues.push("固定消息不能同时配置随机消息来源。");
    }
  } else if (mode === "random") {
    if (step.text != null) issues.push("随机消息不能同时配置固定 text。");
    if (source === "manual") {
      issues.push(...validateMessageList(step.messages));
      if (step.message_group_id != null) issues.push("手动列表不能同时引用实时分组。");
      if (Array.isArray(step.messages)) candidates = step.messages;
    } else if (source === "group") {
      if (
        typeof step.message_group_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          step.message_group_id,
        )
      )
        issues.push("请选择有效的消息库分组。");
      if (step.messages != null) issues.push("实时分组不能同时保存手动消息列表。");
    } else issues.push("随机消息来源必须是 manual 或 group。");
  } else issues.push("消息模式必须是 fixed 或 random。");
  if (variables) {
    candidates.forEach((candidate, index) => {
      if (typeof candidate !== "string") return;
      const names = [
        ...candidate.matchAll(/(?<!\\)\{\{\s*([A-Za-z_][A-Za-z0-9_]{0,63})\s*\}\}/g),
      ].map((match) => match[1]);
      const missing = [...new Set(names)].filter((name) => !variables.has(name));
      if (missing.length)
        issues.push(`第 ${index + 1} 条消息引用了未知变量：${missing.join("、")}。`);
    });
  }
  return issues;
}

export function messageStepSummary(step: WorkflowStep): string {
  if ((step.message_mode ?? "fixed") === "fixed") {
    return typeof step.text === "string" && step.text ? step.text : "待填写消息文本";
  }
  if (step.random_source === "group")
    return step.message_group_id ? "随机消息 · 实时分组" : "待选择消息分组";
  return `随机消息 · 手动列表 ${Array.isArray(step.messages) ? step.messages.length : 0} 条`;
}
