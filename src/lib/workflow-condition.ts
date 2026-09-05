export type WorkflowValueType = "text" | "number" | "datetime";

export type WorkflowStep = Record<string, unknown> & {
  type?: string;
  node_id?: string;
};

export type ConditionRegexConfig = {
  ignore_case: boolean;
  multiline: boolean;
  match_mode: "search" | "full";
};

export type ConditionExtract = {
  name: string;
  source: "message_text" | "metadata";
  mode: "whole_text" | "first_number" | "regex_capture" | "metadata";
  value_type: WorkflowValueType;
  field?: string;
  pattern?: string;
  capture_group?: number | string;
  regex?: ConditionRegexConfig;
};

export type ConditionOperand =
  | { source: "literal"; value: string }
  | { source: "variable"; name: string };

export type ConditionNormalization = {
  trim: boolean;
  ignore_case: boolean;
  collapse_whitespace: boolean;
  strip_markdown: boolean;
};

export type ConditionRule = {
  variable: string;
  value_type: WorkflowValueType;
  operator: string;
  operands: ConditionOperand[];
  normalization?: ConditionNormalization;
  regex?: ConditionRegexConfig;
};

export type ConditionBranch = {
  kind: "if" | "else_if" | "else";
  name?: string;
  logic?: "and" | "or";
  conditions?: ConditionRule[];
  steps: WorkflowStep[];
};

export type ConditionStep = WorkflowStep & {
  type: "condition";
  node_id: string;
  schema_version: 2;
  strict: boolean;
  extracts: ConditionExtract[];
  branches: ConditionBranch[];
};

export type ConditionPathSegment = {
  branchIndex: number;
  stepIndex: number;
};

export type ConditionValidationIssue = {
  path: string;
  message: string;
};

export type WorkflowVariableDefinition = {
  name: string;
  valueType: WorkflowValueType;
};

export const CONDITION_LIMITS = {
  extracts: 10,
  branches: 20,
  conditionsPerBranch: 10,
  regexLength: 500,
  nestingDepth: 3,
} as const;

/**
 * Return a user-facing error when a regex cannot be parsed by the browser.
 *
 * The backend remains the source of truth (it uses Python's `regex` engine),
 * but compiling here catches the common syntax mistakes while the workflow is
 * being edited instead of waiting for a save request to fail.
 */
export function getRegexSyntaxError(
  pattern: string,
  config?: Pick<ConditionRegexConfig, "ignore_case" | "multiline">,
): string | null {
  if (!pattern) return null;
  const flags = `${config?.ignore_case ? "i" : ""}${config?.multiline ? "m" : ""}`;
  try {
    void new RegExp(pattern, flags);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    return detail ? `正则表达式语法无效：${detail}` : "正则表达式语法无效。";
  }
}

/**
 * Validate the constraints shared by regex input fields.
 *
 * Empty values and the length limit are kept here as well so field-level
 * feedback and the condition workspace summary cannot drift apart.
 */
export function validateRegexPattern(
  pattern: string,
  config?: Pick<ConditionRegexConfig, "ignore_case" | "multiline">,
): string | null {
  if (!pattern) return "请输入正则表达式。";
  if (pattern.length > CONDITION_LIMITS.regexLength) {
    return `正则表达式最多 ${CONDITION_LIMITS.regexLength} 个字符。`;
  }
  return getRegexSyntaxError(pattern, config);
}

export const CONDITION_METADATA_FIELDS: Array<{
  value: string;
  label: string;
  valueType: WorkflowValueType;
}> = [
  { value: "sender.id", label: "发送者 ID", valueType: "number" },
  { value: "sender.username", label: "发送者用户名", valueType: "text" },
  { value: "sender.display_name", label: "发送者显示名称", valueType: "text" },
  { value: "chat.id", label: "聊天 ID", valueType: "number" },
  { value: "chat.title", label: "聊天标题", valueType: "text" },
  { value: "chat.username", label: "聊天用户名", valueType: "text" },
  { value: "chat.type", label: "聊天类型", valueType: "text" },
  { value: "message.id", label: "消息 ID", valueType: "number" },
  { value: "message.date", label: "消息日期时间", valueType: "datetime" },
  { value: "message.text", label: "消息文本", valueType: "text" },
  { value: "message.type", label: "消息类型", valueType: "text" },
  {
    value: "runtime.last_clicked_callback_data_text",
    label: "最近点击的 Callback data（文本）",
    valueType: "text",
  },
  {
    value: "runtime.last_clicked_callback_data_base64",
    label: "最近点击的 Callback data（Base64）",
    valueType: "text",
  },
];

export const CONDITION_OPERATORS: Record<
  WorkflowValueType,
  Array<{ value: string; label: string; operands: 0 | 1 | 2 | "many" }>
> = {
  number: [
    { value: "gt", label: "> 大于", operands: 1 },
    { value: "gte", label: "≥ 大于等于", operands: 1 },
    { value: "lt", label: "< 小于", operands: 1 },
    { value: "lte", label: "≤ 小于等于", operands: 1 },
    { value: "eq", label: "= 等于", operands: 1 },
    { value: "ne", label: "≠ 不等于", operands: 1 },
    { value: "between", label: "between 区间内", operands: 2 },
    { value: "in", label: "in 集合内", operands: "many" },
    { value: "exists", label: "存在", operands: 0 },
  ],
  text: [
    { value: "exact", label: "精确等于", operands: 1 },
    { value: "not_exact", label: "不等于", operands: 1 },
    { value: "contains", label: "包含", operands: 1 },
    { value: "regex", label: "正则匹配", operands: 1 },
    { value: "starts_with", label: "前缀是", operands: 1 },
    { value: "ends_with", label: "后缀是", operands: 1 },
    { value: "length_eq", label: "长度等于", operands: 1 },
    { value: "length_ne", label: "长度不等于", operands: 1 },
    { value: "length_gt", label: "长度大于", operands: 1 },
    { value: "length_gte", label: "长度大于等于", operands: 1 },
    { value: "length_lt", label: "长度小于", operands: 1 },
    { value: "length_lte", label: "长度小于等于", operands: 1 },
    { value: "length_between", label: "长度在区间内", operands: 2 },
    { value: "in", label: "属于集合", operands: "many" },
    { value: "exists", label: "存在", operands: 0 },
    { value: "empty", label: "为空", operands: 0 },
    { value: "not_empty", label: "不为空", operands: 0 },
  ],
  datetime: [
    { value: "before", label: "早于", operands: 1 },
    { value: "before_or_equal", label: "早于或等于", operands: 1 },
    { value: "after", label: "晚于", operands: 1 },
    { value: "after_or_equal", label: "晚于或等于", operands: 1 },
    { value: "eq", label: "等于", operands: 1 },
    { value: "ne", label: "不等于", operands: 1 },
    { value: "between", label: "在时间区间内", operands: 2 },
    { value: "in", label: "属于时间集合", operands: "many" },
    { value: "exists", label: "存在", operands: 0 },
  ],
};

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const VARIABLE_RESERVED_WORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "def",
  "default",
  "delete",
  "del",
  "do",
  "else",
  "elif",
  "enum",
  "except",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "global",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "is",
  "lambda",
  "let",
  "new",
  "nonlocal",
  "not",
  "null",
  "or",
  "package",
  "pass",
  "private",
  "protected",
  "public",
  "raise",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);
const LENGTH_OPERATORS = new Set([
  "length_eq",
  "length_ne",
  "length_gt",
  "length_gte",
  "length_lt",
  "length_lte",
  "length_between",
]);

export function createNodeId(prefix = "node"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultRegexConfig(): ConditionRegexConfig {
  return { ignore_case: false, multiline: false, match_mode: "search" };
}

export function createDefaultNormalization(): ConditionNormalization {
  return {
    trim: true,
    ignore_case: false,
    collapse_whitespace: false,
    strip_markdown: false,
  };
}

export function createDefaultExtract(index = 0): ConditionExtract {
  return {
    name: index === 0 ? "value" : `value_${index + 1}`,
    source: "message_text",
    mode: "whole_text",
    value_type: "text",
  };
}

export function createDefaultRule(variable = "value", valueType: WorkflowValueType = "text") {
  return {
    variable,
    value_type: valueType,
    operator: valueType === "text" ? "not_empty" : "exists",
    operands: [],
    ...(valueType === "text" ? { normalization: createDefaultNormalization() } : {}),
  } satisfies ConditionRule;
}

export function createDefaultConditionStep(): ConditionStep {
  return {
    type: "condition",
    node_id: createNodeId("condition"),
    schema_version: 2,
    strict: false,
    extracts: [createDefaultExtract()],
    branches: [
      {
        kind: "if",
        name: "满足条件",
        logic: "and",
        conditions: [createDefaultRule()],
        steps: [],
      },
      { kind: "else", name: "否则", steps: [] },
    ],
  };
}

export function createWorkflowStep(type: string): WorkflowStep {
  if (type === "condition") return createDefaultConditionStep();
  if (type === "send_message") return { type, node_id: createNodeId("send"), text: "" };
  if (type === "wait_message") {
    return { type, node_id: createNodeId("wait"), timeout_seconds: 60 };
  }
  if (type === "click_button") return { type, node_id: createNodeId("click"), text: "" };
  return { type, node_id: createNodeId("step") };
}

function legacyOperatorValueType(operator: string): WorkflowValueType {
  return ["gt", "gte", "lt", "lte", "eq", "ne", "between", "in"].includes(operator)
    ? "number"
    : "text";
}

export function normalizeConditionStep(step: WorkflowStep): ConditionStep {
  if (step.type === "condition" && step.schema_version === 2) {
    return structuredClone(step) as ConditionStep;
  }

  const extracts: ConditionExtract[] = [];
  const legacyExtract = step.extract;
  if (legacyExtract && typeof legacyExtract === "object") {
    const item = legacyExtract as Record<string, unknown>;
    if (typeof item.name === "string" && item.name) {
      const mode = ["whole_text", "first_number", "regex_capture"].includes(String(item.mode))
        ? (item.mode as ConditionExtract["mode"])
        : "whole_text";
      const extract: ConditionExtract = {
        name: item.name,
        source: "message_text",
        mode,
        value_type: mode === "first_number" ? "number" : "text",
      };
      if (mode === "regex_capture") {
        extract.pattern = String(item.pattern ?? "");
        extract.capture_group =
          typeof item.group === "number" || typeof item.group === "string" ? item.group : 1;
        extract.regex = createDefaultRegexConfig();
      }
      extracts.push(extract);
    }
  }

  const legacyBranches = Array.isArray(step.branches) ? step.branches : [];
  const branches = legacyBranches.map((rawBranch, branchIndex): ConditionBranch => {
    const branch = (rawBranch ?? {}) as Record<string, unknown>;
    const rawKind = String(branch.kind ?? (branchIndex === 0 ? "if" : "else-if"));
    const kind: ConditionBranch["kind"] =
      rawKind === "else" ? "else" : branchIndex === 0 ? "if" : "else_if";
    const normalized: ConditionBranch = {
      kind,
      name: typeof branch.name === "string" ? branch.name : String(branch.label ?? "") || undefined,
      steps: ensureWorkflowNodeIds(
        Array.isArray(branch.steps) ? (branch.steps as WorkflowStep[]) : [],
      ),
    };
    if (kind === "else") return normalized;

    const rawRules = Array.isArray(branch.when) ? branch.when : [branch.when ?? {}];
    normalized.logic = String(branch.logic).toLowerCase() === "or" ? "or" : "and";
    normalized.conditions = rawRules.map((rawRule, ruleIndex) => {
      const rule = (rawRule ?? {}) as Record<string, unknown>;
      const operator = String(rule.operator ?? "exact");
      const valueType = legacyOperatorValueType(operator);
      let variable = typeof rule.name === "string" ? rule.name : "";
      if (rule.source !== undefined && rule.source !== "variable") {
        variable = `legacy_${branchIndex + 1}_${ruleIndex + 1}`;
      }
      const rawValue = rule.value;
      const values = operator === "between" || operator === "in" ? rawValue : [rawValue];
      return {
        variable,
        value_type: valueType,
        operator,
        operands: (Array.isArray(values) ? values : []).map((value) => ({
          source: "literal" as const,
          value: String(value ?? ""),
        })),
        ...(valueType === "text"
          ? {
              normalization: {
                trim: Boolean(rule.trim),
                ignore_case: Boolean(rule.ignore_case),
                collapse_whitespace: false,
                strip_markdown: false,
              },
            }
          : {}),
        ...(operator === "regex" ? { regex: createDefaultRegexConfig() } : {}),
      };
    });
    return normalized;
  });

  const safeBranches = branches.length >= 2 ? branches : createDefaultConditionStep().branches;
  safeBranches[0].kind = "if";
  safeBranches[safeBranches.length - 1].kind = "else";
  for (let index = 1; index < safeBranches.length - 1; index += 1) {
    safeBranches[index].kind = "else_if";
  }

  return {
    type: "condition",
    node_id:
      typeof step.node_id === "string"
        ? step.node_id
        : typeof step.nodeId === "string"
          ? step.nodeId
          : createNodeId("condition"),
    schema_version: 2,
    strict: Boolean(step.strict),
    extracts,
    branches: safeBranches,
  };
}

export function ensureWorkflowNodeIds(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step) => {
    if (step.type === "condition") {
      const condition = normalizeConditionStep(step);
      return {
        ...condition,
        node_id: condition.node_id || createNodeId("condition"),
        branches: condition.branches.map((branch) => ({
          ...branch,
          steps: ensureWorkflowNodeIds(branch.steps),
        })),
      };
    }
    return {
      ...step,
      node_id:
        typeof step.node_id === "string" && step.node_id
          ? step.node_id
          : createNodeId(step.type ?? "step"),
    };
  });
}

function variableMap(definitions: WorkflowVariableDefinition[]) {
  return new Map(definitions.map((definition) => [definition.name, definition.valueType]));
}

function variableDefinitions(values: Map<string, WorkflowValueType>): WorkflowVariableDefinition[] {
  return [...values].map(([name, valueType]) => ({ name, valueType }));
}

export function inferWorkflowVariables(
  steps: WorkflowStep[],
  inherited: WorkflowVariableDefinition[] = [],
): WorkflowVariableDefinition[] {
  const current = variableMap(inherited);
  for (const step of steps) {
    if (step.type !== "condition") continue;
    const condition = normalizeConditionStep(step);
    for (const extract of condition.extracts) current.set(extract.name, extract.value_type);
    const branchOutputs = condition.branches.map((branch) =>
      variableMap(inferWorkflowVariables(branch.steps, variableDefinitions(current))),
    );
    if (branchOutputs.length === 0) continue;
    for (const [name, valueType] of branchOutputs[0]) {
      if (branchOutputs.every((output) => output.get(name) === valueType)) {
        current.set(name, valueType);
      }
    }
  }
  return variableDefinitions(current);
}

export function variablesBeforeStep(
  steps: WorkflowStep[],
  index: number,
  inherited: WorkflowVariableDefinition[] = [],
): WorkflowVariableDefinition[] {
  return inferWorkflowVariables(steps.slice(0, index), inherited);
}

export function variablesAtConditionPath(
  root: ConditionStep,
  path: ConditionPathSegment[],
  inherited: WorkflowVariableDefinition[] = [],
): WorkflowVariableDefinition[] {
  let current = root;
  let visible = variableMap(inherited);
  for (const extract of current.extracts) visible.set(extract.name, extract.value_type);
  for (const segment of path) {
    const branch = current.branches[segment.branchIndex];
    if (!branch) break;
    visible = variableMap(
      inferWorkflowVariables(
        branch.steps.slice(0, segment.stepIndex),
        variableDefinitions(visible),
      ),
    );
    const nested = branch.steps[segment.stepIndex];
    if (nested?.type !== "condition") break;
    current = normalizeConditionStep(nested);
    for (const extract of current.extracts) visible.set(extract.name, extract.value_type);
  }
  return variableDefinitions(visible);
}

export function workflowHasWait(steps: WorkflowStep[], inherited = false): boolean {
  let hasWait = inherited;
  for (const step of steps) {
    if (step.type === "wait_message") {
      hasWait = true;
      continue;
    }
    if (step.type !== "condition") continue;
    const condition = normalizeConditionStep(step);
    hasWait = condition.branches.every((branch) => workflowHasWait(branch.steps, hasWait));
  }
  return hasWait;
}

export function waitBeforeStep(steps: WorkflowStep[], index: number, inherited = false): boolean {
  return workflowHasWait(steps.slice(0, index), inherited);
}

export function waitAtConditionPath(
  root: ConditionStep,
  path: ConditionPathSegment[],
  inherited = false,
): boolean {
  let current = root;
  let hasWait = inherited;
  for (const segment of path) {
    const branch = current.branches[segment.branchIndex];
    if (!branch) break;
    hasWait = workflowHasWait(branch.steps.slice(0, segment.stepIndex), hasWait);
    const nested = branch.steps[segment.stepIndex];
    if (nested?.type !== "condition") break;
    current = normalizeConditionStep(nested);
  }
  return hasWait;
}

export function getNestedCondition(
  root: ConditionStep,
  path: ConditionPathSegment[],
): ConditionStep {
  let current = root;
  for (const segment of path) {
    const nested = current.branches[segment.branchIndex]?.steps[segment.stepIndex];
    if (nested?.type !== "condition") throw new Error("条件节点路径无效。");
    current = normalizeConditionStep(nested);
  }
  return current;
}

export function updateNestedCondition(
  root: ConditionStep,
  path: ConditionPathSegment[],
  next: ConditionStep,
): ConditionStep {
  if (path.length === 0) return next;
  const [head, ...tail] = path;
  const branch = root.branches[head.branchIndex];
  const nested = branch?.steps[head.stepIndex];
  if (!branch || !nested || nested.type !== "condition") return root;
  const updatedNested = updateNestedCondition(normalizeConditionStep(nested), tail, next);
  return {
    ...root,
    branches: root.branches.map((item, branchIndex) =>
      branchIndex !== head.branchIndex
        ? item
        : {
            ...item,
            steps: item.steps.map((step, stepIndex) =>
              stepIndex === head.stepIndex ? updatedNested : step,
            ),
          },
    ),
  };
}

function expectedOperandCount(rule: ConditionRule): 0 | 1 | 2 | "many" {
  return (
    CONDITION_OPERATORS[rule.value_type].find((operator) => operator.value === rule.operator)
      ?.operands ?? 1
  );
}

export function reconcileRuleOperands(rule: ConditionRule): ConditionRule {
  const expected = expectedOperandCount(rule);
  let operands = rule.operands;
  if (expected === 0) operands = [];
  else if (expected === 1) operands = [operands[0] ?? { source: "literal", value: "" }];
  else if (expected === 2) {
    operands = [
      operands[0] ?? { source: "literal", value: "" },
      operands[1] ?? { source: "literal", value: "" },
    ];
  } else if (operands.length === 0) operands = [{ source: "literal", value: "" }];
  const { normalization, regex, ...base } = rule;
  return {
    ...base,
    operands,
    ...(rule.value_type === "text"
      ? { normalization: normalization ?? createDefaultNormalization() }
      : {}),
    ...(rule.operator === "regex" ? { regex: regex ?? createDefaultRegexConfig() } : {}),
  };
}

export function operandValueType(rule: ConditionRule): WorkflowValueType {
  return LENGTH_OPERATORS.has(rule.operator) ? "number" : rule.value_type;
}

export function validateConditionStep(
  step: ConditionStep,
  depth = 1,
  inherited: WorkflowVariableDefinition[] = [],
  hasPriorWait = true,
): ConditionValidationIssue[] {
  const issues: ConditionValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (depth > CONDITION_LIMITS.nestingDepth) add("branches", "条件节点嵌套不能超过 3 层。");
  if (!step.node_id) add("node_id", "条件节点缺少稳定 ID。");
  if (step.extracts.length > CONDITION_LIMITS.extracts) add("extracts", "提取变量最多 10 个。");
  if (step.extracts.length > 0 && !hasPriorWait) {
    add("extracts", "提取消息变量前，所有到达路径都必须先有成功的等待消息节点。");
  }

  const variables = variableMap(inherited);
  step.extracts.forEach((extract, index) => {
    const path = `extracts.${index}`;
    if (!VARIABLE_NAME.test(extract.name) || extract.name.startsWith("__")) {
      add(
        `${path}.name`,
        "变量名须符合 Python/JavaScript 标识符规范：以英文字母或下划线开头，只含英文、数字、下划线，最多 64 个字符，且不能使用 __ 前缀。",
      );
    }
    if (VARIABLE_RESERVED_WORDS.has(extract.name)) {
      add(`${path}.name`, "变量名不能使用 Python/JavaScript 保留关键字。");
    }
    if (variables.has(extract.name)) add(`${path}.name`, "变量名不能重复。");
    variables.set(extract.name, extract.value_type);
    if (extract.mode === "first_number" && extract.value_type !== "number") {
      add(`${path}.value_type`, "首个数字提取必须保存为数值。");
    }
    if (
      extract.source === "metadata" &&
      !CONDITION_METADATA_FIELDS.some((item) => item.value === extract.field)
    ) {
      add(`${path}.field`, "请选择受支持的消息元数据字段。");
    }
    if (extract.mode === "regex_capture") {
      const pattern = typeof extract.pattern === "string" ? extract.pattern : "";
      const regexIssue = validateRegexPattern(pattern, extract.regex);
      if (regexIssue) add(`${path}.pattern`, regexIssue);
      if (
        extract.capture_group === "" ||
        (typeof extract.capture_group === "number" && extract.capture_group < 0)
      ) {
        add(`${path}.capture_group`, "捕获组必须是非负编号或非空名称。");
      }
    }
  });

  if (step.branches.length < 2 || step.branches.length > CONDITION_LIMITS.branches) {
    add("branches", "条件节点必须有 2–20 个分支。");
  }
  if (step.branches[0]?.kind !== "if") add("branches.0.kind", "首个分支必须是 if。");
  if (step.branches.at(-1)?.kind !== "else") add("branches", "最后一个分支必须是 else。");

  step.branches.forEach((branch, branchIndex) => {
    const path = `branches.${branchIndex}`;
    if (branch.kind !== "else") {
      const conditions = branch.conditions ?? [];
      if (conditions.length < 1 || conditions.length > CONDITION_LIMITS.conditionsPerBranch) {
        add(`${path}.conditions`, "每个判断分支必须有 1–10 条条件。");
      }
      conditions.forEach((rule, ruleIndex) => {
        const rulePath = `${path}.conditions.${ruleIndex}`;
        const variableType = variables.get(rule.variable);
        if (!variableType) add(`${rulePath}.variable`, "请选择已提取的变量。");
        else if (variableType !== rule.value_type)
          add(`${rulePath}.value_type`, "变量类型与条件类型不一致。");
        const operator = CONDITION_OPERATORS[rule.value_type].find(
          (item) => item.value === rule.operator,
        );
        if (!operator) add(`${rulePath}.operator`, "该变量类型不支持此判断方式。");
        if (operator?.operands === "many" && rule.operands.length === 0) {
          add(`${rulePath}.operands`, "集合判断至少需要一个值。");
        } else if (
          typeof operator?.operands === "number" &&
          rule.operands.length !== operator.operands
        ) {
          add(`${rulePath}.operands`, `此判断方式需要 ${operator.operands} 个比较值。`);
        }
        if (rule.operator === "regex") {
          const first = rule.operands[0];
          if (first?.source === "literal") {
            const pattern = typeof first.value === "string" ? first.value : "";
            const regexIssue = validateRegexPattern(pattern, rule.regex);
            if (regexIssue) add(`${rulePath}.operands.0`, regexIssue);
          }
        }
      });
    }
    let branchVariables = variableDefinitions(variables);
    let branchHasWait = hasPriorWait;
    branch.steps.forEach((nested, stepIndex) => {
      if (nested.type === "condition") {
        for (const issue of validateConditionStep(
          normalizeConditionStep(nested),
          depth + 1,
          branchVariables,
          branchHasWait,
        )) {
          add(`${path}.steps.${stepIndex}.${issue.path}`, issue.message);
        }
      }
      branchVariables = inferWorkflowVariables([nested], branchVariables);
      branchHasWait = workflowHasWait([nested], branchHasWait);
    });
  });
  return issues;
}

/**
 * Validate every condition node in a workflow, including top-level nodes.
 *
 * The condition workspace validates its currently open node. This companion
 * helper covers the whole definition so YAML mode and direct form submission
 * cannot bypass the same regex checks.
 */
export function validateWorkflowConditions(
  steps: WorkflowStep[],
  inheritedVariables: WorkflowVariableDefinition[] = [],
  inheritedWait = false,
): ConditionValidationIssue[] {
  const issues: ConditionValidationIssue[] = [];
  let variables = inheritedVariables;
  let hasWait = inheritedWait;

  steps.forEach((step, index) => {
    if (step.type === "condition") {
      const condition = normalizeConditionStep(step);
      for (const issue of validateConditionStep(condition, 1, variables, hasWait)) {
        issues.push({ ...issue, path: `steps.${index}.${issue.path}` });
      }
      variables = inferWorkflowVariables([condition], variables);
      hasWait = workflowHasWait([condition], hasWait);
      return;
    }
    variables = inferWorkflowVariables([step], variables);
    hasWait = workflowHasWait([step], hasWait);
  });

  return issues;
}
