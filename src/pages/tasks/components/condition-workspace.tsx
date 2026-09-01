// biome-ignore-all lint/suspicious/noArrayIndexKey: Controlled condition rows are reordered transactionally; index keys keep text inputs focused while their values change.
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskRunLog, TaskRunProgress, TaskStepStatus } from "@/lib/api/types";
import {
  CONDITION_LIMITS,
  CONDITION_METADATA_FIELDS,
  CONDITION_OPERATORS,
  type ConditionBranch,
  type ConditionExtract,
  type ConditionOperand,
  type ConditionPathSegment,
  type ConditionRule,
  type ConditionStep,
  createDefaultExtract,
  createDefaultNormalization,
  createDefaultRegexConfig,
  createDefaultRule,
  getNestedCondition,
  normalizeConditionStep,
  operandValueType,
  reconcileRuleOperands,
  updateNestedCondition,
  validateConditionStep,
  variablesAtConditionPath,
  type WorkflowStep,
  type WorkflowValueType,
  type WorkflowVariableDefinition,
  waitAtConditionPath,
} from "@/lib/workflow-condition";

type BranchSequenceRenderer = (props: {
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

type DeleteRequest = { kind: "branch"; index: number } | null;

const VALUE_TYPES: Array<{ value: WorkflowValueType; label: string }> = [
  { value: "text", label: "文本" },
  { value: "number", label: "数值" },
  { value: "datetime", label: "日期时间" },
];

const EXTRACT_MODES: Array<{ value: ConditionExtract["mode"]; label: string }> = [
  { value: "whole_text", label: "全文" },
  { value: "first_number", label: "首个数字" },
  { value: "regex_capture", label: "正则捕获组" },
  { value: "metadata", label: "消息元数据" },
];

const OPERAND_SOURCE_OPTIONS: Array<{ value: ConditionOperand["source"]; label: string }> = [
  { value: "literal", label: "固定值" },
  { value: "variable", label: "变量" },
];

function keyedEntries<T>(items: T[], identity: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map((item, index) => {
    const value = identity(item);
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return { item, index, key: `${value}-${occurrence}` };
  });
}

function cloneCondition(step: ConditionStep): ConditionStep {
  return structuredClone(step);
}

function branchLabel(branch: ConditionBranch, index: number) {
  if (branch.name?.trim()) return branch.name;
  if (branch.kind === "if") return "If";
  if (branch.kind === "else") return "Else";
  return `Else if ${index}`;
}

function updateExtractMode(
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

function ExtractionCard({
  extract,
  index,
  readOnly,
  onChange,
  onDelete,
}: {
  extract: ConditionExtract;
  index: number;
  readOnly: boolean;
  onChange: (next: ConditionExtract) => void;
  onDelete: () => void;
}) {
  const regex = extract.regex ?? createDefaultRegexConfig();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>变量 {index + 1}</CardTitle>
        <CardDescription>从最近一次成功等待到的消息中提取。</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-3 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor={`extract-name-${index}`}>变量名</FieldLabel>
              <Input
                id={`extract-name-${index}`}
                value={extract.name}
                disabled={readOnly}
                onChange={(event) => onChange({ ...extract, name: event.target.value })}
                placeholder="例如：balance"
              />
            </Field>
            <Field>
              <FieldLabel>提取方式</FieldLabel>
              <Select
                items={EXTRACT_MODES}
                value={extract.mode}
                disabled={readOnly}
                onValueChange={(value) =>
                  value && onChange(updateExtractMode(extract, value as ConditionExtract["mode"]))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {EXTRACT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>变量类型</FieldLabel>
              <Select
                items={VALUE_TYPES}
                value={extract.value_type}
                disabled={
                  readOnly || extract.mode === "first_number" || extract.mode === "metadata"
                }
                onValueChange={(value) =>
                  value && onChange({ ...extract, value_type: value as WorkflowValueType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {VALUE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {extract.mode === "metadata" ? (
            <Field>
              <FieldLabel>元数据字段</FieldLabel>
              <Select
                items={CONDITION_METADATA_FIELDS}
                value={extract.field}
                disabled={readOnly}
                onValueChange={(value) => {
                  const selected = CONDITION_METADATA_FIELDS.find((item) => item.value === value);
                  if (selected) {
                    onChange({ ...extract, field: selected.value, value_type: selected.valueType });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择元数据" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CONDITION_METADATA_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {extract.mode === "regex_capture" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`extract-pattern-${index}`}>正则表达式</FieldLabel>
                <Textarea
                  id={`extract-pattern-${index}`}
                  className="font-mono text-xs"
                  value={extract.pattern ?? ""}
                  disabled={readOnly}
                  maxLength={CONDITION_LIMITS.regexLength}
                  onChange={(event) => onChange({ ...extract, pattern: event.target.value })}
                  placeholder="例如：余额：([\d,]+)"
                />
                <FieldDescription>
                  默认搜索子串，最多 500 字符；运行时单次最多 50ms、单节点总预算 200ms。
                </FieldDescription>
              </Field>
              <div className="grid gap-3 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`extract-group-${index}`}>捕获组</FieldLabel>
                  <Input
                    id={`extract-group-${index}`}
                    value={String(extract.capture_group ?? 1)}
                    disabled={readOnly}
                    onChange={(event) => {
                      const value = event.target.value;
                      onChange({
                        ...extract,
                        capture_group: /^\d+$/.test(value) ? Number(value) : value,
                      });
                    }}
                    placeholder="编号 1 或命名组名称"
                  />
                </Field>
                <Field>
                  <FieldLabel>匹配范围</FieldLabel>
                  <ToggleGroup
                    value={[regex.match_mode]}
                    disabled={readOnly}
                    onValueChange={(values) =>
                      values[0] &&
                      onChange({
                        ...extract,
                        regex: { ...regex, match_mode: values[0] as "search" | "full" },
                      })
                    }
                  >
                    <ToggleGroupItem value="search">子串搜索</ToggleGroupItem>
                    <ToggleGroupItem value="full">全量匹配</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </div>
              <div className="flex flex-wrap gap-5">
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`extract-ignore-case-${index}`}>忽略大小写（i）</FieldLabel>
                  <Switch
                    id={`extract-ignore-case-${index}`}
                    checked={regex.ignore_case}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...extract, regex: { ...regex, ignore_case: checked } })
                    }
                  />
                </Field>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`extract-multiline-${index}`}>多行（m）</FieldLabel>
                  <Switch
                    id={`extract-multiline-${index}`}
                    checked={regex.multiline}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...extract, regex: { ...regex, multiline: checked } })
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          ) : null}
          {!readOnly ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 data-icon="inline-start" />
                删除变量
              </Button>
            </div>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function OperandEditor({
  operand,
  index,
  valueType,
  variables,
  multiple,
  readOnly,
  onChange,
  onDelete,
}: {
  operand: ConditionOperand;
  index: number;
  valueType: WorkflowValueType;
  variables: Array<{ name: string; valueType: WorkflowValueType }>;
  multiple: boolean;
  readOnly: boolean;
  onChange: (operand: ConditionOperand) => void;
  onDelete: () => void;
}) {
  const compatibleVariables = variables.filter((item) => item.valueType === valueType);
  const compatibleVariableItems = compatibleVariables.map((variable) => ({
    value: variable.name,
    label: variable.name,
  }));
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <Select
        items={OPERAND_SOURCE_OPTIONS}
        value={operand.source}
        disabled={readOnly}
        onValueChange={(value) =>
          onChange(
            value === "variable"
              ? { source: "variable", name: compatibleVariables[0]?.name ?? "" }
              : { source: "literal", value: "" },
          )
        }
      >
        <SelectTrigger className="w-full" aria-label={`比较值 ${index + 1} 来源`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {OPERAND_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {operand.source === "variable" ? (
        <Select
          items={compatibleVariableItems}
          value={operand.name}
          disabled={readOnly}
          onValueChange={(value) => value && onChange({ source: "variable", name: value })}
        >
          <SelectTrigger className="w-full" aria-label={`比较变量 ${index + 1}`}>
            <SelectValue placeholder="选择变量" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {compatibleVariables.map((variable) => (
                <SelectItem key={variable.name} value={variable.name}>
                  {variable.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Input
          aria-label={`比较值 ${index + 1}`}
          value={operand.value}
          disabled={readOnly}
          onChange={(event) => onChange({ source: "literal", value: event.target.value })}
          placeholder={
            valueType === "number"
              ? "支持 -1,234.50 或 1 234.50"
              : valueType === "datetime"
                ? "例如：2026-08-31 10:30:00"
                : "输入比较文本"
          }
        />
      )}
      {multiple && !readOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label="删除比较值"
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}

function ConditionRuleCard({
  rule,
  index,
  variables,
  readOnly,
  onChange,
  onDelete,
}: {
  rule: ConditionRule;
  index: number;
  variables: Array<{ name: string; valueType: WorkflowValueType }>;
  readOnly: boolean;
  onChange: (rule: ConditionRule) => void;
  onDelete: () => void;
}) {
  const operators = CONDITION_OPERATORS[rule.value_type];
  const operator = operators.find((item) => item.value === rule.operator) ?? operators[0];
  const normalization = rule.normalization ?? createDefaultNormalization();
  const regex = rule.regex ?? createDefaultRegexConfig();
  const operandType = operandValueType(rule);
  const setRule = (next: ConditionRule) => onChange(reconcileRuleOperands(next));
  const variableItems = variables.map((variable) => ({
    value: variable.name,
    label: `${variable.name} · ${
      VALUE_TYPES.find((item) => item.value === variable.valueType)?.label ?? variable.valueType
    }`,
  }));
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>条件 {index + 1}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field>
              <FieldLabel>引用变量</FieldLabel>
              <Select
                items={variableItems}
                value={rule.variable}
                disabled={readOnly}
                onValueChange={(value) => {
                  const variable = variables.find((item) => item.name === value);
                  if (!variable) return;
                  setRule(createDefaultRule(variable.name, variable.valueType));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="先在上方提取变量" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {variables.map((variable) => (
                      <SelectItem key={variable.name} value={variable.name}>
                        {variable.name} ·{" "}
                        {VALUE_TYPES.find((item) => item.value === variable.valueType)?.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>判断方式</FieldLabel>
              <Select
                items={operators}
                value={rule.operator}
                disabled={readOnly}
                onValueChange={(value) => value && setRule({ ...rule, operator: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {operators.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {operator.operands !== 0 ? (
            <Field>
              <FieldLabel>{operator.operands === 2 ? "区间边界" : "比较值"}</FieldLabel>
              <div className="flex flex-col gap-2">
                {rule.operands.map((operand, operandIndex) => (
                  <OperandEditor
                    key={`operand-${operandIndex}`}
                    operand={operand}
                    index={operandIndex}
                    valueType={operandType}
                    variables={variables}
                    multiple={operator.operands === "many" && rule.operands.length > 1}
                    readOnly={readOnly}
                    onChange={(next) =>
                      onChange({
                        ...rule,
                        operands: rule.operands.map((item, itemIndex) =>
                          itemIndex === operandIndex ? next : item,
                        ),
                      })
                    }
                    onDelete={() =>
                      onChange({
                        ...rule,
                        operands: rule.operands.filter(
                          (_, itemIndex) => itemIndex !== operandIndex,
                        ),
                      })
                    }
                  />
                ))}
                {operator.operands === "many" && !readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...rule,
                        operands: [...rule.operands, { source: "literal", value: "" }],
                      })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    添加集合值
                  </Button>
                ) : null}
              </div>
            </Field>
          ) : null}
          {rule.value_type === "text" ? (
            <FieldSet>
              <FieldLegend variant="label">字符归一化</FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    ["trim", "去除首尾空白"],
                    ["ignore_case", "忽略大小写"],
                    ["collapse_whitespace", "压缩连续空白"],
                    ["strip_markdown", "去除 Markdown"],
                  ] as const
                ).map(([field, label]) => (
                  <Field orientation="horizontal" key={field}>
                    <FieldLabel htmlFor={`rule-${index}-${field}`}>{label}</FieldLabel>
                    <Switch
                      id={`rule-${index}-${field}`}
                      size="sm"
                      checked={normalization[field]}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...rule,
                          normalization: { ...normalization, [field]: checked },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </FieldSet>
          ) : null}
          {rule.operator === "regex" ? (
            <FieldSet>
              <FieldLegend variant="label">正则执行</FieldLegend>
              <div className="flex flex-wrap items-center gap-5">
                <ToggleGroup
                  value={[regex.match_mode]}
                  disabled={readOnly}
                  onValueChange={(values) =>
                    values[0] &&
                    onChange({
                      ...rule,
                      regex: { ...regex, match_mode: values[0] as "search" | "full" },
                    })
                  }
                >
                  <ToggleGroupItem value="search">子串搜索</ToggleGroupItem>
                  <ToggleGroupItem value="full">全量匹配</ToggleGroupItem>
                </ToggleGroup>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`rule-${index}-regex-i`}>忽略大小写（i）</FieldLabel>
                  <Switch
                    id={`rule-${index}-regex-i`}
                    size="sm"
                    checked={regex.ignore_case}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...rule, regex: { ...regex, ignore_case: checked } })
                    }
                  />
                </Field>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`rule-${index}-regex-m`}>多行（m）</FieldLabel>
                  <Switch
                    id={`rule-${index}-regex-m`}
                    size="sm"
                    checked={regex.multiline}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...rule, regex: { ...regex, multiline: checked } })
                    }
                  />
                </Field>
              </div>
              <FieldDescription>
                正则固定值最多 500 字符，运行时采用安全超时与输入长度限制。
              </FieldDescription>
            </FieldSet>
          ) : null}
          {!readOnly ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 data-icon="inline-start" />
                删除条件
              </Button>
            </div>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ConditionRunSummary({ status }: { status?: TaskStepStatus }) {
  if (!status) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>本次运行</CardTitle>
        <CardDescription>
          {status.selectedBranch
            ? `命中分支：${status.selectedBranch.name || status.selectedBranch.kind}`
            : "尚未记录命中分支"}
        </CardDescription>
      </CardHeader>
      {status.conditionVariables?.length ? (
        <CardContent className="flex flex-wrap gap-2">
          {status.conditionVariables.map((variable) => (
            <Badge
              key={variable.name}
              variant={variable.status === "failed" ? "destructive" : "outline"}
            >
              {variable.name}
              {variable.value != null
                ? ` = ${variable.value}`
                : variable.error
                  ? ` · ${variable.error}`
                  : ""}
            </Badge>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function ConditionWorkspace({
  step,
  open,
  readOnly = false,
  run,
  runLogs,
  runStatus,
  availableVariables = [],
  hasPriorWait = true,
  onOpenChange,
  onApply,
  renderSequence,
}: {
  step: WorkflowStep | null;
  open: boolean;
  readOnly?: boolean;
  run?: TaskRunProgress | null;
  runLogs?: TaskRunLog[];
  runStatus?: TaskStepStatus;
  availableVariables?: WorkflowVariableDefinition[];
  hasPriorWait?: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (step: ConditionStep) => void;
  renderSequence: BranchSequenceRenderer;
}) {
  const normalized = useMemo(
    () => (step?.type === "condition" ? normalizeConditionStep(step) : null),
    [step],
  );
  const [draft, setDraft] = useState<ConditionStep | null>(normalized);
  const [path, setPath] = useState<ConditionPathSegment[]>([]);
  const [activeBranch, setActiveBranch] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(normalized ? cloneCondition(normalized) : null);
    setPath([]);
    setActiveBranch(0);
  }, [normalized, open]);

  const dirty = Boolean(
    draft && normalized && JSON.stringify(draft) !== JSON.stringify(normalized),
  );
  const current = useMemo(() => {
    if (!draft) return null;
    try {
      return getNestedCondition(draft, path);
    } catch {
      return draft;
    }
  }, [draft, path]);
  const variables = useMemo(
    () => (draft ? variablesAtConditionPath(draft, path, availableVariables) : []),
    [availableVariables, draft, path],
  );
  const issues = useMemo(
    () => (draft ? validateConditionStep(draft, 1, availableVariables, hasPriorWait) : []),
    [availableVariables, draft, hasPriorWait],
  );
  const currentHasWait = useMemo(
    () => (draft ? waitAtConditionPath(draft, path, hasPriorWait) : hasPriorWait),
    [draft, hasPriorWait, path],
  );
  const currentRuntimePath = useMemo(() => {
    if (!runStatus?.stepPath) return undefined;
    return path.reduce(
      (prefix, segment) => `${prefix}.branches[${segment.branchIndex}].steps[${segment.stepIndex}]`,
      runStatus.stepPath,
    );
  }, [path, runStatus?.stepPath]);
  const currentRunStatus = useMemo(() => {
    if (!current) return undefined;
    return (
      run?.stepStatuses.find(
        (status) =>
          (current.node_id && status.nodeId === current.node_id) ||
          (currentRuntimePath && status.stepPath === currentRuntimePath),
      ) ?? (path.length === 0 ? runStatus : undefined)
    );
  }, [current, currentRuntimePath, path.length, run?.stepStatuses, runStatus]);
  const currentBranch = current?.branches[activeBranch] ?? current?.branches[0];

  const updateCurrent = (next: ConditionStep) => {
    if (!draft || readOnly) return;
    setDraft(updateNestedCondition(draft, path, next));
  };
  const updateBranch = (next: ConditionBranch) => {
    if (!current) return;
    updateCurrent({
      ...current,
      branches: current.branches.map((branch, index) => (index === activeBranch ? next : branch)),
    });
  };
  const requestClose = () => {
    if (!readOnly && dirty) setConfirmClose(true);
    else onOpenChange(false);
  };
  const apply = () => {
    if (!draft || issues.length > 0) return;
    onApply(draft);
    onOpenChange(false);
  };
  const addBranch = () => {
    if (!current || current.branches.length >= CONDITION_LIMITS.branches) return;
    const firstVariable = variables[0];
    const nextBranch: ConditionBranch = {
      kind: "else_if",
      name: `条件分支 ${current.branches.length}`,
      logic: "and",
      conditions: [
        createDefaultRule(firstVariable?.name ?? "", firstVariable?.valueType ?? "text"),
      ],
      steps: [],
    };
    const nextBranches = [...current.branches];
    nextBranches.splice(nextBranches.length - 1, 0, nextBranch);
    updateCurrent({ ...current, branches: nextBranches });
    setActiveBranch(nextBranches.length - 2);
  };
  const deleteBranch = (index: number) => {
    if (!current || index <= 0 || index >= current.branches.length - 1) return;
    const nextBranches = current.branches.filter((_, itemIndex) => itemIndex !== index);
    updateCurrent({ ...current, branches: nextBranches });
    setActiveBranch(Math.max(0, Math.min(index - 1, nextBranches.length - 1)));
  };
  const moveBranch = (index: number, direction: -1 | 1) => {
    if (!current) return;
    const target = index + direction;
    if (
      index <= 0 ||
      index >= current.branches.length - 1 ||
      target <= 0 ||
      target >= current.branches.length - 1
    ) {
      return;
    }
    const next = [...current.branches];
    [next[index], next[target]] = [next[target], next[index]];
    updateCurrent({ ...current, branches: next });
    setActiveBranch(target);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="inset-2 top-2 left-2 h-[calc(100%-1rem)] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className="flex items-center gap-2">
                  <GitBranch aria-hidden="true" />
                  条件判断工作区
                  {readOnly ? <Badge variant="outline">只读</Badge> : null}
                </DialogTitle>
                <DialogDescription>
                  先提取变量，再按顺序配置 if / else if / else；命中首个分支后自动汇合。
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={requestClose}
                aria-label="关闭条件工作区"
              >
                <X />
              </Button>
            </div>
            {draft && path.length > 0 ? (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => {
                        setPath([]);
                        setActiveBranch(0);
                      }}
                    >
                      根条件
                    </Button>
                  </BreadcrumbItem>
                  {keyedEntries(
                    path,
                    (segment) => `${segment.branchIndex}-${segment.stepIndex}`,
                  ).map(({ index, key }) => {
                    const label = `嵌套条件 ${index + 1}`;
                    return (
                      <span className="contents" key={key}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {index === path.length - 1 ? (
                            <BreadcrumbPage>{label}</BreadcrumbPage>
                          ) : (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={() => {
                                setPath(path.slice(0, index + 1));
                                setActiveBranch(0);
                              }}
                            >
                              {label}
                            </Button>
                          )}
                        </BreadcrumbItem>
                      </span>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </DialogHeader>

          {current && currentBranch ? (
            <div className="grid min-h-0 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
                  <span className="text-sm font-medium">分支</span>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={addBranch}
                      disabled={current.branches.length >= CONDITION_LIMITS.branches}
                      aria-label="添加 else if 分支"
                    >
                      <Plus />
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
                  {keyedEntries(current.branches, (branch) => JSON.stringify(branch)).map(
                    ({ item: branch, index, key }) => {
                      const selected = index === activeBranch;
                      const selectedAtRuntime = currentRunStatus?.selectedBranch?.index === index;
                      return (
                        <Button
                          key={key}
                          type="button"
                          variant={selected ? "secondary" : "ghost"}
                          className="h-auto min-w-40 justify-between py-2 text-left lg:min-w-0"
                          onClick={() => setActiveBranch(index)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{branchLabel(branch, index)}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {branch.kind === "if"
                                ? "IF"
                                : branch.kind === "else"
                                  ? "ELSE"
                                  : "ELSE IF"}
                              {branch.kind !== "else"
                                ? ` · ${branch.conditions?.length ?? 0} 条件`
                                : ""}
                            </span>
                          </span>
                          {selectedAtRuntime ? (
                            <Badge variant="secondary">已命中</Badge>
                          ) : currentRunStatus?.selectedBranch ? (
                            <Badge variant="outline">已跳过</Badge>
                          ) : (
                            <ChevronRight />
                          )}
                        </Button>
                      );
                    },
                  )}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto p-4 lg:p-5">
                <div className="mx-auto flex max-w-6xl flex-col gap-5">
                  <ConditionRunSummary status={currentRunStatus} />
                  <FieldSet>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <FieldLegend>变量提取</FieldLegend>
                        <FieldDescription>
                          变量贯穿本次工作流运行，后续消息、等待匹配和按钮定位可用{" "}
                          {"{{ variable }}"} 引用。
                        </FieldDescription>
                      </div>
                      {!readOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={current.extracts.length >= CONDITION_LIMITS.extracts}
                          onClick={() =>
                            updateCurrent({
                              ...current,
                              extracts: [
                                ...current.extracts,
                                createDefaultExtract(current.extracts.length),
                              ],
                            })
                          }
                        >
                          <Plus data-icon="inline-start" />
                          添加变量
                        </Button>
                      ) : null}
                    </div>
                    {current.extracts.length === 0 ? (
                      <Card size="sm">
                        <CardContent className="text-sm text-muted-foreground">
                          尚未在此节点提取变量；仍可引用前序路径上已存在的变量。
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-3">
                        {current.extracts.map((extract, index) => (
                          <ExtractionCard
                            key={`extract-${index}`}
                            extract={extract}
                            index={index}
                            readOnly={readOnly}
                            onChange={(next) =>
                              updateCurrent({
                                ...current,
                                extracts: current.extracts.map((item, itemIndex) =>
                                  itemIndex === index ? next : item,
                                ),
                              })
                            }
                            onDelete={() =>
                              updateCurrent({
                                ...current,
                                extracts: current.extracts.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </FieldSet>

                  <Separator />

                  <FieldSet>
                    <FieldLegend>节点行为</FieldLegend>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="condition-strict">严格模式</FieldLabel>
                        <FieldDescription>
                          关闭时，提取失败、变量不存在或类型不符按 false
                          进入后续分支；开启时直接使任务失败。
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="condition-strict"
                        checked={current.strict}
                        disabled={readOnly}
                        onCheckedChange={(strict) => updateCurrent({ ...current, strict })}
                      />
                    </Field>
                  </FieldSet>

                  <Separator />

                  <FieldSet>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <FieldLegend>{branchLabel(currentBranch, activeBranch)}</FieldLegend>
                        <FieldDescription>
                          {currentBranch.kind === "else"
                            ? "前面的判断均未命中时执行。"
                            : "按当前分支的 AND / OR 组合判断；不支持嵌套逻辑组。"}
                        </FieldDescription>
                      </div>
                      {!readOnly && currentBranch.kind === "else_if" ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={activeBranch <= 1}
                            onClick={() => moveBranch(activeBranch, -1)}
                            aria-label="上移分支"
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={activeBranch >= current.branches.length - 2}
                            onClick={() => moveBranch(activeBranch, 1)}
                            aria-label="下移分支"
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              currentBranch.steps.length > 0
                                ? setDeleteRequest({ kind: "branch", index: activeBranch })
                                : deleteBranch(activeBranch)
                            }
                            aria-label="删除分支"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <Field>
                      <FieldLabel htmlFor="branch-name">分支名称</FieldLabel>
                      <Input
                        id="branch-name"
                        value={currentBranch.name ?? ""}
                        maxLength={80}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateBranch({ ...currentBranch, name: event.target.value })
                        }
                        placeholder={currentBranch.kind === "else" ? "否则" : "例如：余额充足"}
                      />
                    </Field>
                    {currentBranch.kind !== "else" ? (
                      <FieldGroup>
                        <Field>
                          <FieldLabel>条件组合</FieldLabel>
                          <ToggleGroup
                            value={[currentBranch.logic ?? "and"]}
                            disabled={readOnly}
                            onValueChange={(values) =>
                              values[0] &&
                              updateBranch({ ...currentBranch, logic: values[0] as "and" | "or" })
                            }
                          >
                            <ToggleGroupItem value="and">全部满足（AND）</ToggleGroupItem>
                            <ToggleGroupItem value="or">任一满足（OR）</ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                        <div className="grid gap-3">
                          {(currentBranch.conditions ?? []).map((rule, index) => (
                            <ConditionRuleCard
                              key={`condition-${index}`}
                              rule={rule}
                              index={index}
                              variables={variables}
                              readOnly={readOnly}
                              onChange={(next) =>
                                updateBranch({
                                  ...currentBranch,
                                  conditions: (currentBranch.conditions ?? []).map(
                                    (item, itemIndex) => (itemIndex === index ? next : item),
                                  ),
                                })
                              }
                              onDelete={() =>
                                updateBranch({
                                  ...currentBranch,
                                  conditions: (currentBranch.conditions ?? []).filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }
                            />
                          ))}
                        </div>
                        {!readOnly ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              (currentBranch.conditions?.length ?? 0) >=
                              CONDITION_LIMITS.conditionsPerBranch
                            }
                            onClick={() => {
                              const variable = variables[0];
                              updateBranch({
                                ...currentBranch,
                                conditions: [
                                  ...(currentBranch.conditions ?? []),
                                  createDefaultRule(
                                    variable?.name ?? "",
                                    variable?.valueType ?? "text",
                                  ),
                                ],
                              });
                            }}
                          >
                            <Plus data-icon="inline-start" />
                            添加条件
                          </Button>
                        ) : null}
                      </FieldGroup>
                    ) : null}
                  </FieldSet>

                  <Separator />

                  <FieldSet>
                    <FieldLegend>分支步骤</FieldLegend>
                    <FieldDescription>
                      此分支执行完会自动返回主流程；可继续添加普通节点或最多嵌套 3 层条件节点。
                    </FieldDescription>
                    {renderSequence({
                      steps: currentBranch.steps,
                      onChange: (steps) => updateBranch({ ...currentBranch, steps }),
                      onConditionSelect: (stepIndex) => {
                        setPath([...path, { branchIndex: activeBranch, stepIndex }]);
                        setActiveBranch(0);
                      },
                      readOnly,
                      run,
                      runLogs,
                      inheritedVariables: variables,
                      inheritedWait: currentHasWait,
                      pathPrefix: currentRuntimePath
                        ? `${currentRuntimePath}.branches[${activeBranch}].steps`
                        : undefined,
                    })}
                  </FieldSet>

                  {issues.length > 0 && !readOnly ? (
                    <Card size="sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle aria-hidden="true" />
                          还需完成 {issues.length} 项配置
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive">
                          {issues.slice(0, 8).map((issue) => (
                            <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </main>
            </div>
          ) : (
            <div className="grid min-h-0 place-items-center p-8 text-muted-foreground">
              无法读取条件节点配置。
            </div>
          )}

          <DialogFooter className="m-0 rounded-none px-4 py-3">
            <Button type="button" variant="outline" onClick={requestClose}>
              {readOnly ? "关闭" : "取消"}
            </Button>
            {!readOnly ? (
              <Button type="button" onClick={apply} disabled={!draft || issues.length > 0}>
                <CheckCircle2 data-icon="inline-start" />
                应用条件配置
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未应用的条件配置？</AlertDialogTitle>
            <AlertDialogDescription>
              条件工作区中的修改尚未应用到任务，关闭后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteRequest !== null}
        onOpenChange={(open) => !open && setDeleteRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除此分支及其中步骤？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会移除分支内全部节点。应用条件配置前仍可通过取消整个工作区放弃本次修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteRequest?.kind === "branch") deleteBranch(deleteRequest.index);
                setDeleteRequest(null);
              }}
            >
              删除分支
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
