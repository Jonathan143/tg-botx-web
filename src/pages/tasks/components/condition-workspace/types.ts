import type { ReactNode } from "react";

import type { TaskRunLog, TaskRunProgress } from "@/lib/api/types";
import {
  CONDITION_METADATA_FIELDS,
  CONDITION_OPERATORS,
  type ConditionBranch,
  type ConditionExtract,
  type ConditionOperand,
  createDefaultRegexConfig,
  type WorkflowStep,
  type WorkflowValueType,
  type WorkflowVariableDefinition,
} from "@/lib/workflow-condition";

export type BranchSequenceRenderer = (props: {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  onConditionSelect: (stepIndex: number) => void;
  readOnly: boolean;
  run?: TaskRunProgress | null;
  runLogs?: TaskRunLog[];
  inheritedVariables: WorkflowVariableDefinition[];
  inheritedWait: boolean;
  pathPrefix?: string;
}) => ReactNode;

export type DeleteRequest = { kind: "branch"; index: number } | null;

export const VALUE_TYPES: Array<{ value: WorkflowValueType; label: string }> = [
  { value: "text", label: "文本" },
  { value: "number", label: "数值" },
  { value: "datetime", label: "日期时间" },
];

export const EXTRACT_MODES: Array<{ value: ConditionExtract["mode"]; label: string }> = [
  { value: "whole_text", label: "全文" },
  { value: "first_number", label: "首个数字" },
  { value: "regex_capture", label: "正则捕获组" },
  { value: "metadata", label: "消息元数据" },
];

export const OPERAND_SOURCE_OPTIONS: Array<{
  value: ConditionOperand["source"];
  label: string;
}> = [
  { value: "literal", label: "固定值" },
  { value: "variable", label: "变量" },
];

export function keyedEntries<T>(items: T[], identity: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map((item, index) => {
    const value = identity(item);
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return { item, index, key: `${value}-${occurrence}` };
  });
}

export function cloneCondition<T>(step: T): T {
  return structuredClone(step);
}

export function branchLabel(branch: ConditionBranch, index: number) {
  if (branch.name?.trim()) return branch.name;
  if (branch.kind === "if") return "If";
  if (branch.kind === "else") return "Else";
  return `Else if ${index}`;
}

export function updateExtractMode(
  extract: ConditionExtract,
  mode: ConditionExtract["mode"],
): ConditionExtract {
  if (mode === "metadata") {
    const metadata = CONDITION_METADATA_FIELDS[0];
    return {
      name: extract.name,
      source: "metadata",
      mode,
      field: metadata.value,
      value_type: metadata.valueType,
    };
  }
  const next: ConditionExtract = {
    name: extract.name,
    source: "message_text",
    mode,
    value_type: mode === "first_number" ? "number" : extract.value_type,
  };
  if (mode === "regex_capture") {
    next.pattern = "";
    next.capture_group = 1;
    next.regex = createDefaultRegexConfig();
  }
  return next;
}

export { CONDITION_OPERATORS };
