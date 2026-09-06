import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import {
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Flag,
  GitBranch,
  Globe,
  type LucideIcon,
  MessageCircle,
  MousePointerClick,
  Play,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TaskRunLog, TaskRunProgress, TaskStepStatus } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CONDITION_METADATA_FIELDS,
  type ConditionExtract,
  createWorkflowStep,
  ensureWorkflowNodeIds,
  normalizeConditionStep,
  validateRegexPattern,
  validateWorkflowVariableName,
  variablesBeforeStep,
  type WorkflowStep,
  type WorkflowVariableDefinition,
  waitBeforeStep,
} from "@/lib/workflow-condition";

import { ConditionWorkspace } from "./condition-workspace";
import { ExtractionFields, FieldLabelWithHint } from "./condition-workspace/extraction-card";
import { VALUE_TYPES } from "./condition-workspace/types";

import "@xyflow/react/dist/style.css";

export type { WorkflowStep } from "@/lib/workflow-condition";

type WorkflowNodeData = {
  index: number;
  stepCount: number;
  step: WorkflowStep;
  selected: boolean;
  runStatus?: string | null;
  durationMs?: number | null;
  error?: string | null;
  botResponse?: string | null;
  botButtons?: string[][] | null;
  readOnly?: boolean;
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
};

type DisplayNodeData = {
  kind: "start" | "end";
  label: string;
};

type WorkflowCanvasNode = Node<WorkflowNodeData | DisplayNodeData>;

type WorkflowEdgeData = {
  insertIndex: number;
  readOnly?: boolean;
  onInsert: (index: number, type: string) => void;
};

const STEP_TYPES: Array<{
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { value: "send_message", label: "发送消息", description: "向目标聊天发送文本", icon: Send },
  {
    value: "wait_message",
    label: "等待消息",
    description: "等待机器人或用户消息",
    icon: MessageCircle,
  },
  {
    value: "click_button",
    label: "点击按钮",
    description: "点击当前消息中的按钮",
    icon: MousePointerClick,
  },
  {
    value: "condition",
    label: "条件判断",
    description: "提取变量并按 if / else 分支执行",
    icon: GitBranch,
  },
  { value: "http_request", label: "HTTP 请求", description: "调用外部 HTTP 接口", icon: Globe },
  { value: "extract_variable", label: "提取变量", description: "从前置节点提取变量", icon: Braces },
];

const stepIcon = (step: WorkflowStep) =>
  STEP_TYPES.find((item) => item.value === step.type)?.icon ?? CircleAlert;

function StepIcon({ step, className }: { step: WorkflowStep; className?: string }) {
  const Icon = stepIcon(step);
  return <Icon className={className} aria-hidden="true" />;
}

const stepLabel = (step: WorkflowStep) =>
  STEP_TYPES.find((item) => item.value === step.type)?.label ??
  `未知步骤（${step.type ?? "未指定"}）`;

const stepSummary = (step: WorkflowStep) => {
  if (step.type === "send_message")
    return typeof step.text === "string" && step.text ? step.text : "待填写消息文本";
  if (step.type === "wait_message") {
    const matcher = step.success;
    return matcher
      ? `匹配 ${typeof matcher === "string" ? matcher : "高级规则"}`
      : "等待任意新消息";
  }
  if (step.type === "click_button") {
    const callback = step.callback_data;
    if (callback !== undefined) {
      return callback ? `定位 ${String(callback)}` : "待填写按钮定位条件";
    }
    const containsText = step.text_contains;
    if (containsText !== undefined) {
      return containsText ? `定位 ${String(containsText)}` : "待填写按钮定位条件";
    }
    if (step.text !== undefined) {
      return step.text ? `定位 ${String(step.text)}` : "待填写按钮定位条件";
    }
    if (step.row !== undefined || step.column !== undefined) {
      return `定位 行 ${String(step.row ?? "?")} · 列 ${String(step.column ?? "?")}`;
    }
    return "待填写按钮定位条件";
  }
  if (step.type === "condition") {
    const condition = normalizeConditionStep(step);
    const ifCount = condition.branches.filter((branch) => branch.kind !== "else").length;
    return `${condition.extracts.length} 个变量 · ${ifCount} 个判断分支 · 含 else`;
  }
  if (step.type === "http_request") return `${step.method ?? "GET"} ${step.url || "待填写 URL"}`;
  if (step.type === "extract_variable") return `{{ ${step.name || "variable"} }}`;
  return "请切换到 YAML 高级模式编辑";
};

function runBadge(status?: string | null) {
  if (!status) return null;
  const variant =
    status === "success" ? "secondary" : status === "failed" ? "destructive" : "outline";
  const label = {
    running: "运行中",
    pending: "等待中",
    success: "成功",
    failed: "失败",
    skipped: "已跳过",
  }[status];
  return <Badge variant={variant}>{label ?? status}</Badge>;
}

function formatStepDuration(durationMs?: number | null) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  const seconds = (durationMs / 1000).toFixed(2).replace(/\.?0+$/, "");
  return `${seconds}s`;
}

function TelegramMessagePreview({
  text,
  buttons,
  compact = false,
}: {
  text?: string | null;
  buttons?: string[][] | null;
  compact?: boolean;
}) {
  const rows = (buttons ?? []).filter((row) => Array.isArray(row) && row.length > 0);
  const rowKeyCounts = new Map<string, number>();
  if (!text && rows.length === 0) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-muted/30",
        compact ? "text-xs" : "text-sm",
      )}
    >
      {text ? (
        <div className="whitespace-pre-wrap break-words px-3 py-2 text-foreground">{text}</div>
      ) : null}
      {rows.length > 0 ? (
        <div className="grid gap-1 border-t bg-muted/20 p-1.5" role="group" aria-label="机器人按钮">
          {rows.map((row) => {
            const rowIdentity = JSON.stringify(row);
            const rowOccurrence = rowKeyCounts.get(rowIdentity) ?? 0;
            rowKeyCounts.set(rowIdentity, rowOccurrence + 1);
            const rowKey = `button-row-${rowIdentity}-${rowOccurrence}`;
            const labelKeyCounts = new Map<string, number>();

            return (
              <div
                className="grid gap-1"
                key={rowKey}
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map((label) => {
                  const labelOccurrence = labelKeyCounts.get(label) ?? 0;
                  labelKeyCounts.set(label, labelOccurrence + 1);
                  return (
                    <span
                      className={cn(
                        "flex min-w-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 px-2 text-center font-medium text-primary",
                        compact ? "min-h-7 py-1 text-[11px]" : "min-h-9 py-1.5",
                      )}
                      key={`button-${rowKey}-${label}-${labelOccurrence}`}
                    >
                      <span className="break-words">{label}</span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function BotResponsePreview({
  text,
  buttons,
  compact = false,
}: {
  text?: string | null;
  buttons?: string[][] | null;
  compact?: boolean;
}) {
  if (!text && (!buttons || buttons.length === 0)) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        机器人回复
      </p>
      <TelegramMessagePreview text={text} buttons={buttons} compact={compact} />
    </div>
  );
}

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const invalid = data.step.type === "send_message" && typeof data.step.text !== "string";
  const durationLabel = formatStepDuration(data.durationMs);
  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md",
        data.selected && "border-primary ring-2 ring-primary/20",
        invalid && "border-destructive/60",
      )}
      onClick={() => data.onSelect(data.index)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onSelect(data.index);
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-primary" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">步骤 {data.index + 1}</span>
            {runBadge(data.runStatus)}
            {durationLabel ? (
              <span className="text-xs tabular-nums text-muted-foreground">{durationLabel}</span>
            ) : null}
            {invalid ? <CircleAlert className="text-destructive" aria-label="配置不完整" /> : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <StepIcon step={data.step} className="size-4 shrink-0 text-primary" />
            <p className="truncate font-medium">{stepLabel(data.step)}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{stepSummary(data.step)}</p>
          {data.error ? (
            <p className="mt-1 line-clamp-2 text-xs text-destructive">{data.error}</p>
          ) : null}
          <BotResponsePreview text={data.botResponse} buttons={data.botButtons} compact />
        </div>
      </div>
      {!data.readOnly ? (
        <div className="mt-3 flex justify-end gap-1 border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              data.onMove(data.index, -1);
            }}
            disabled={data.index === 0}
            aria-label="上移"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              data.onMove(data.index, 1);
            }}
            disabled={data.index >= data.stepCount - 1}
            aria-label="下移"
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              data.onDelete(data.index);
            }}
            aria-label="删除步骤"
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-primary" />
    </div>
  );
}

function DisplayNode({ data }: NodeProps<Node<DisplayNodeData>>) {
  const isStart = data.kind === "start";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
        isStart
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-muted-foreground/30 bg-muted text-muted-foreground",
      )}
    >
      {isStart ? <Play aria-hidden="true" /> : <Flag aria-hidden="true" />}
      <span>{data.label}</span>
      {isStart ? (
        <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-primary" />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !border-0 !bg-muted-foreground"
        />
      )}
    </div>
  );
}

function StepTypeMenu({
  onSelect,
  compact = false,
  onOpenChange,
}: {
  onSelect: (type: string) => void;
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon-sm" : "sm"}
            aria-label={compact ? "添加步骤" : undefined}
            title={compact ? "添加步骤" : undefined}
          />
        }
      >
        <Plus data-icon="inline-start" />
        {!compact ? "添加步骤" : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>选择节点类型</DropdownMenuLabel>
          {STEP_TYPES.map((type) => (
            <DropdownMenuItem key={type.value} onClick={() => onSelect(type.value)}>
              <type.icon aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span>{type.label}</span>
                <span className="text-xs text-muted-foreground">{type.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  animated,
  data,
}: EdgeProps<Edge<WorkflowEdgeData>>) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const visible = hovered || menuOpen;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={animated ? "stroke-primary" : undefined}
        interactionWidth={48}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {!data?.readOnly ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "nodrag nopan pointer-events-auto absolute transition-opacity duration-150",
              visible ? "opacity-100" : "opacity-0",
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <StepTypeMenu
              compact
              onOpenChange={setMenuOpen}
              onSelect={(type) => data?.onInsert(data.insertIndex, type)}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = { workflow: WorkflowNode, display: DisplayNode };
const edgeTypes = { workflow: WorkflowEdge };

function makeStep(type: string): WorkflowStep {
  return createWorkflowStep(type);
}

function updateButtonField(
  step: WorkflowStep,
  onChange: (step: WorkflowStep) => void,
  field: "text" | "text_contains" | "callback_data" | "row" | "column",
  value: unknown,
) {
  const next = { ...step };
  if (value === undefined) delete next[field];
  else next[field] = value;
  onChange(next);
}

type MatcherMode = "contains" | "exact" | "regex";

const MATCHER_MODES: Array<{ value: MatcherMode; label: string }> = [
  { value: "contains", label: "包含" },
  { value: "exact", label: "精确" },
  { value: "regex", label: "正则" },
];

function readMatcher(matcher: unknown): { values: string[]; mode: MatcherMode } {
  const items = Array.isArray(matcher) ? matcher : [matcher];
  const firstRule = items.find(
    (item): item is { mode?: unknown; value?: unknown } =>
      Boolean(item) && typeof item === "object",
  );
  const mode = MATCHER_MODES.some((item) => item.value === firstRule?.mode)
    ? (firstRule?.mode as MatcherMode)
    : "contains";
  const values = items.map((item) =>
    item && typeof item === "object"
      ? String((item as { value?: unknown }).value ?? "")
      : String(item ?? ""),
  );
  return { values: values.length > 0 ? values : [""], mode };
}

function MatcherField({
  id,
  label,
  description,
  placeholder,
  matcher,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  matcher: unknown;
  onChange: (matcher: unknown) => void;
}) {
  const parsedMatcher = readMatcher(matcher);
  const [modeOverride, setModeOverride] = useState<MatcherMode | null>(null);
  const mode = matcher == null ? (modeOverride ?? parsedMatcher.mode) : parsedMatcher.mode;
  const { values } = parsedMatcher;
  const entryKeysRef = useRef<string[]>([]);
  const nextEntryIdRef = useRef(0);
  while (entryKeysRef.current.length < values.length) {
    entryKeysRef.current.push(`${id}-${nextEntryIdRef.current}`);
    nextEntryIdRef.current += 1;
  }
  if (entryKeysRef.current.length > values.length) {
    entryKeysRef.current.length = values.length;
  }
  const updateMatcher = (nextValues: string[], nextMode: MatcherMode) => {
    const cleanValues = nextValues.filter((value) => value.length > 0);
    if (cleanValues.length === 0) {
      onChange(undefined);
      return;
    }
    if (cleanValues.length === 1 && nextMode === "contains") {
      onChange(cleanValues[0]);
      return;
    }
    const rules = cleanValues.map((value) => ({ mode: nextMode, value }));
    onChange(rules.length === 1 ? rules[0] : rules);
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        value={[mode]}
        onValueChange={(nextValues) => {
          const nextMode = nextValues[0] as MatcherMode | undefined;
          if (nextMode && MATCHER_MODES.some((item) => item.value === nextMode)) {
            setModeOverride(nextMode);
            updateMatcher(values, nextMode);
          }
        }}
      >
        {MATCHER_MODES.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-2">
        {values.map((value, index) => (
          <div className="flex gap-2" key={entryKeysRef.current[index]}>
            <Input
              id={`${id}-${index}`}
              aria-label={`${label} ${index + 1}`}
              value={value}
              onChange={(event) => {
                const nextValues = [...values];
                nextValues[index] = event.target.value;
                updateMatcher(nextValues, mode);
              }}
              placeholder={placeholder}
            />
            {values.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  entryKeysRef.current.splice(index, 1);
                  updateMatcher(
                    values.filter((_, itemIndex) => itemIndex !== index),
                    mode,
                  );
                }}
              >
                移除
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!values.some(Boolean)}
          onClick={() => onChange([...values.filter(Boolean), { mode, value: "" }])}
        >
          添加 OR 条件
        </Button>
      </div>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

function validateStepConfiguration(step: WorkflowStep, priorSteps: WorkflowStep[]): string[] {
  const issues: string[] = [];
  const add = (message: string) => issues.push(message);

  if (step.type === "send_message" && (typeof step.text !== "string" || !step.text.trim())) {
    add("请输入消息文本。");
  }

  if (step.type === "wait_message") {
    if (!readMatcher(step.success).values.some((value) => value.trim())) {
      add("请填写成功匹配规则。");
    }
    if (!Number.isInteger(step.timeout_seconds) || Number(step.timeout_seconds) < 1) {
      add("超时必须是大于 0 的整数秒数。");
    }
  }

  if (step.type === "click_button") {
    const textSelectors = [step.text, step.text_contains, step.callback_data].filter(
      (value) => typeof value === "string" && value.trim(),
    );
    const hasPosition =
      Number.isInteger(step.row) &&
      Number(step.row) >= 0 &&
      Number.isInteger(step.column) &&
      Number(step.column) >= 0;
    if (textSelectors.length + Number(hasPosition) !== 1) {
      add("请完整配置一种按钮定位方式。");
    }
  }

  if (step.type === "http_request") {
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(step.method ?? "GET"))) {
      add("请选择有效的 HTTP 请求方法。");
    }
    if (typeof step.url !== "string" || !step.url.trim()) add("请输入请求 URL。");
    if (step.headers !== undefined && typeof step.headers !== "string") {
      add("请求头必须是字符串。");
    } else if (typeof step.headers === "string" && step.headers.trim()) {
      try {
        const headers = JSON.parse(step.headers) as unknown;
        if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
          add("请求头必须是 JSON 对象。");
        }
      } catch {
        add("请求头必须是有效的 JSON 对象。");
      }
    }
  }

  if (step.type === "extract_variable") {
    const nameIssue = validateWorkflowVariableName(String(step.name ?? ""));
    if (nameIssue) add(nameIssue);
    if (!["text", "number", "datetime"].includes(String(step.value_type ?? "text"))) {
      add("请选择有效的变量类型。");
    }

    const source = String(step.source ?? "");
    const sourceId = String(step.source_node_id ?? "");
    if (source === "http_body") {
      if (!sourceId) {
        add("请选择提供数据的前置 HTTP 请求节点。");
      } else if (
        !priorSteps.some((item) => item.type === "http_request" && item.node_id === sourceId)
      ) {
        add("所选 HTTP 请求数据源节点无效，请重新选择。");
      }
    } else if (source === "wait_message_text") {
      if (!sourceId) {
        add("请选择提供数据的前置等待消息节点。");
      } else if (
        !priorSteps.some((item) => item.type === "wait_message" && item.node_id === sourceId)
      ) {
        add("所选等待消息数据源节点无效，请重新选择。");
      }
      const mode = String(step.mode ?? "whole_text");
      if (!["whole_text", "first_number", "regex_capture", "metadata"].includes(mode)) {
        add("请选择有效的提取方式。");
      }
      if (mode === "first_number" && step.value_type !== "number") {
        add("首个数字提取必须保存为数值类型。");
      }
      if (
        mode === "metadata" &&
        !CONDITION_METADATA_FIELDS.some((item) => item.value === step.field)
      ) {
        add("请选择有效的消息元数据字段。");
      }
      if (mode === "regex_capture") {
        const regexIssue = validateRegexPattern(
          typeof step.pattern === "string" ? step.pattern : "",
          step.regex && typeof step.regex === "object"
            ? (step.regex as ConditionExtract["regex"])
            : undefined,
        );
        if (regexIssue) add(regexIssue);
        if (
          step.capture_group === "" ||
          (typeof step.capture_group === "number" && step.capture_group < 0)
        ) {
          add("捕获组必须是非负编号或非空名称。");
        }
      }
    } else {
      add("请选择有效的提取源类型。");
    }
  }

  return issues;
}

function StepFields({
  step,
  onChange,
  priorSteps = [],
}: {
  step: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
  priorSteps?: WorkflowStep[];
}) {
  const update = (patch: WorkflowStep) => onChange({ ...step, ...patch });
  if (step.type === "send_message") {
    return (
      <Field>
        <FieldLabel htmlFor="step-text">消息文本</FieldLabel>
        <Textarea
          id="step-text"
          value={typeof step.text === "string" ? step.text : ""}
          onChange={(event) => update({ text: event.target.value })}
          placeholder="输入要发送的消息"
        />
        <FieldDescription>支持 Telegram 文本消息。</FieldDescription>
      </Field>
    );
  }
  if (step.type === "wait_message") {
    return (
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="step-timeout">超时（秒）</FieldLabel>
          <Input
            id="step-timeout"
            type="number"
            min={1}
            value={typeof step.timeout_seconds === "number" ? step.timeout_seconds : 60}
            onChange={(event) => update({ timeout_seconds: Number(event.target.value) || 60 })}
          />
        </Field>
        <MatcherField
          id="step-success"
          label="成功匹配规则"
          description="必填；支持包含、精确、正则和多个 OR 条件。"
          placeholder="请输入成功匹配内容"
          matcher={step.success}
          onChange={(success) => update({ success })}
        />
        <MatcherField
          id="step-failure"
          label="失败条件（可选）"
          description="支持包含、精确、正则和多个 OR 条件；留空表示不设置失败条件。"
          placeholder="留空表示不设置"
          matcher={step.failure}
          onChange={(failure) => update({ failure })}
        />
      </FieldGroup>
    );
  }
  if (step.type === "click_button") {
    const buttonMode =
      step.callback_data !== undefined
        ? "callback"
        : step.text_contains !== undefined
          ? "contains"
          : step.text !== undefined
            ? "exact"
            : "position";
    const changeButtonMode = (mode: string) => {
      const {
        text: _text,
        text_contains: _containsText,
        callback_data: _callback,
        row: _row,
        column: _column,
        ...rest
      } = step;
      const next: WorkflowStep = { ...rest, type: "click_button" };
      if (mode === "exact") next.text = "";
      if (mode === "contains") next.text_contains = "";
      if (mode === "callback") next.callback_data = "";
      if (mode === "position") {
        next.row = 0;
        next.column = 0;
      }
      onChange(next);
    };
    return (
      <FieldGroup>
        <FieldDescription>此步骤依赖前置步骤收到的当前消息。</FieldDescription>
        <Field>
          <FieldLabel>按钮定位方式</FieldLabel>
          <ToggleGroup
            value={[buttonMode]}
            onValueChange={(values) => values[0] && changeButtonMode(values[0])}
          >
            <ToggleGroupItem value="exact">精确文字</ToggleGroupItem>
            <ToggleGroupItem value="contains">包含文字</ToggleGroupItem>
            <ToggleGroupItem value="callback">回调数据</ToggleGroupItem>
            <ToggleGroupItem value="position">行列位置</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>
            {buttonMode === "exact"
              ? "按按钮上显示的文字匹配，适合按钮名称稳定的情况。"
              : buttonMode === "contains"
                ? "只要按钮文字包含输入内容即可，适合按钮带有图标或前后缀的情况。"
                : buttonMode === "callback"
                  ? "按 Telegram 内联按钮的 callback data（回调值）匹配，不是按钮上显示的文字。"
                  : "按键盘位置匹配，行和列都从 0 开始；按钮布局变化后可能失效。"}
          </FieldDescription>
        </Field>
        {buttonMode === "exact" ? (
          <Field>
            <FieldLabel htmlFor="button-text">按钮文字</FieldLabel>
            <Input
              id="button-text"
              value={typeof step.text === "string" ? step.text : ""}
              onChange={(event) => updateButtonField(step, onChange, "text", event.target.value)}
              placeholder="例如：每日签到"
            />
            <FieldDescription>优先精确匹配；没有精确结果时后端允许唯一子串匹配。</FieldDescription>
          </Field>
        ) : null}
        {buttonMode === "contains" ? (
          <Field>
            <FieldLabel htmlFor="button-contains">按钮文字</FieldLabel>
            <Input
              id="button-contains"
              value={typeof step.text_contains === "string" ? step.text_contains : ""}
              onChange={(event) =>
                updateButtonField(step, onChange, "text_contains", event.target.value)
              }
              placeholder="例如：签到"
            />
            <FieldDescription>按钮文字只要包含该内容即可。</FieldDescription>
          </Field>
        ) : null}
        {buttonMode === "callback" ? (
          <Field>
            <FieldLabel htmlFor="button-callback">Callback data（回调数据）</FieldLabel>
            <Input
              id="button-callback"
              value={typeof step.callback_data === "string" ? step.callback_data : ""}
              onChange={(event) =>
                updateButtonField(step, onChange, "callback_data", event.target.value)
              }
              placeholder="例如：checkin_today"
            />
          </Field>
        ) : null}
        {buttonMode === "position" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="button-row">行（从 0 开始）</FieldLabel>
              <Input
                id="button-row"
                type="number"
                min={0}
                value={typeof step.row === "number" ? step.row : 0}
                onChange={(event) => update({ row: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="button-column">列（从 0 开始）</FieldLabel>
              <Input
                id="button-column"
                type="number"
                min={0}
                value={typeof step.column === "number" ? step.column : 0}
                onChange={(event) => update({ column: Number(event.target.value) || 0 })}
              />
            </Field>
          </div>
        ) : null}
        <FieldDescription>四种定位方式互斥，切换方式会清除上一种方式的字段。</FieldDescription>
      </FieldGroup>
    );
  }
  if (step.type === "http_request") {
    return (
      <FieldGroup>
        <Field>
          <FieldLabel>请求方法</FieldLabel>
          <ToggleGroup
            value={[String(step.method ?? "GET")]}
            onValueChange={(v) => v[0] && update({ method: v[0] })}
          >
            <ToggleGroupItem value="GET">GET</ToggleGroupItem>
            <ToggleGroupItem value="POST">POST</ToggleGroupItem>
            <ToggleGroupItem value="PUT">PUT</ToggleGroupItem>
            <ToggleGroupItem value="PATCH">PATCH</ToggleGroupItem>
            <ToggleGroupItem value="DELETE">DELETE</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel>请求 URL</FieldLabel>
          <Input
            value={String(step.url ?? "")}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com/api"
          />
        </Field>
        <Field>
          <FieldLabel>请求头（JSON，可选）</FieldLabel>
          <Textarea
            value={String(step.headers ?? "")}
            onChange={(e) => update({ headers: e.target.value })}
            placeholder='{"Authorization":"Bearer ..."}'
          />
        </Field>
        <Field>
          <FieldLabel>请求体（可选）</FieldLabel>
          <Textarea
            value={String(step.body ?? "")}
            onChange={(e) => update({ body: e.target.value })}
          />
        </Field>
      </FieldGroup>
    );
  }
  if (step.type === "extract_variable") {
    const sourceType = String(step.source ?? "").startsWith("wait")
      ? "wait_message"
      : "http_request";
    const candidates = priorSteps.filter(
      (item) => item.type === (sourceType === "wait_message" ? "wait_message" : "http_request"),
    );
    const sourceId = String(step.source_node_id ?? "");
    const updateSource = (value: string) =>
      update({
        source: value === "wait_message" ? "wait_message_text" : "http_body",
        source_node_id: "",
        path: "",
      });
    const nameError = validateWorkflowVariableName(String(step.name ?? ""));
    const commonFields = (
      <>
        <Field>
          <FieldLabelWithHint hint="必须以字母或下划线开头，只能包含字母、数字、下划线，最多 64 个字符。">
            变量名
          </FieldLabelWithHint>
          <Input
            value={String(step.name ?? "")}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "extract-variable-name-error" : undefined}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="例如：user_id"
          />
          {nameError ? <FieldError id="extract-variable-name-error">{nameError}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel>变量类型</FieldLabel>
          <Select
            items={VALUE_TYPES}
            value={String(step.value_type ?? "text")}
            disabled={step.mode === "first_number" || step.mode === "metadata"}
            onValueChange={(value) => value && update({ value_type: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {VALUE_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </>
    );
    if (sourceType === "http_request") {
      return (
        <FieldGroup>
          {commonFields}
          <Field>
            <FieldLabelWithHint hint="选择从前置 HTTP 请求响应，或等待消息内容中提取变量。">
              提取源类型
            </FieldLabelWithHint>
            <Select
              items={[
                { value: "http_request", label: "HTTP 请求" },
                { value: "wait_message", label: "等待消息" },
              ]}
              value={sourceType}
              onValueChange={(value) => value && updateSource(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="http_request">HTTP 请求</SelectItem>
                  <SelectItem value="wait_message">等待消息</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabelWithHint hint="选择实际提供提取数据的前置节点。">
              数据源节点
            </FieldLabelWithHint>
            <Select
              items={candidates.map((item) => ({
                value: String(item.node_id),
                label: `${String(item.node_id)} · HTTP 请求`,
              }))}
              value={sourceId}
              onValueChange={(value) => value && update({ source_node_id: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择前置 HTTP 节点" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {candidates.map((item) => (
                    <SelectItem key={String(item.node_id)} value={String(item.node_id)}>
                      {String(item.node_id)} · HTTP 请求
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabelWithHint hint="从 JSON 响应中按点号路径提取字段，例如 data.user.id。">
              JSON 路径（可选）
            </FieldLabelWithHint>
            <Input
              value={String(step.path ?? "")}
              onChange={(event) => update({ path: event.target.value })}
              placeholder="data.user.id"
            />
          </Field>
        </FieldGroup>
      );
    }
    const mode = ["whole_text", "first_number", "regex_capture", "metadata"].includes(
      String(step.mode),
    )
      ? (String(step.mode) as ConditionExtract["mode"])
      : "whole_text";
    const valueType = ["text", "number", "datetime"].includes(String(step.value_type))
      ? (String(step.value_type) as ConditionExtract["value_type"])
      : "text";
    const extract: ConditionExtract = {
      name: String(step.name ?? ""),
      source: mode === "metadata" ? "metadata" : "message_text",
      mode,
      value_type: valueType,
      ...(step.field ? { field: String(step.field) } : {}),
      ...(step.pattern !== undefined ? { pattern: String(step.pattern) } : {}),
      ...(step.capture_group !== undefined
        ? { capture_group: step.capture_group as number | string }
        : {}),
      ...(step.regex && typeof step.regex === "object"
        ? { regex: step.regex as ConditionExtract["regex"] }
        : {}),
    };
    const updateExtract = (next: ConditionExtract) => {
      const {
        path: _path,
        extract_source: _extractSource,
        mode: _mode,
        value_type: _valueType,
        field: _field,
        pattern: _pattern,
        capture_group: _captureGroup,
        regex: _regex,
        ...rest
      } = step;
      onChange({
        ...rest,
        source: "wait_message_text",
        name: next.name,
        mode: next.mode,
        value_type: next.value_type,
        ...(next.field ? { field: next.field } : {}),
        ...(next.pattern !== undefined ? { pattern: next.pattern } : {}),
        ...(next.capture_group !== undefined ? { capture_group: next.capture_group } : {}),
        ...(next.regex ? { regex: next.regex } : {}),
      });
    };
    return (
      <FieldGroup>
        {commonFields}
        <Field>
          <FieldLabelWithHint hint="选择从前置 HTTP 请求响应，或等待消息内容中提取变量。">
            提取源类型
          </FieldLabelWithHint>
          <Select
            items={[
              { value: "http_request", label: "HTTP 请求" },
              { value: "wait_message", label: "等待消息" },
            ]}
            value={sourceType}
            onValueChange={(value) => value && updateSource(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="http_request">HTTP 请求</SelectItem>
                <SelectItem value="wait_message">等待消息</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabelWithHint hint="选择实际提供提取数据的前置等待消息节点。">
            数据源节点
          </FieldLabelWithHint>
          <Select
            items={candidates.map((item) => ({
              value: String(item.node_id),
              label: `${String(item.node_id)} · 等待消息`,
            }))}
            value={sourceId}
            onValueChange={(value) => value && update({ source_node_id: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择前置等待消息节点" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {candidates.map((item) => (
                  <SelectItem key={String(item.node_id)} value={String(item.node_id)}>
                    {String(item.node_id)} · 等待消息
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <ExtractionFields
          extract={extract}
          index={0}
          readOnly={false}
          showName={false}
          showValueType={false}
          onChange={updateExtract}
        />
      </FieldGroup>
    );
  }
  return null;
}

export function TaskWorkflowEditor({
  steps,
  run,
  runLogs,
  onChange,
  readOnly = false,
  onConditionSelect,
  inheritedVariables = [],
  inheritedWait = false,
  pathPrefix,
}: {
  steps: WorkflowStep[];
  run?: TaskRunProgress | null;
  runLogs?: TaskRunLog[];
  onChange: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
  onConditionSelect?: (stepIndex: number) => void;
  inheritedVariables?: WorkflowVariableDefinition[];
  inheritedWait?: boolean;
  pathPrefix?: string;
}) {
  const isMobile = useIsMobile();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const emitChange = useCallback(
    (next: WorkflowStep[]) => onChange(ensureWorkflowNodeIds(next)),
    [onChange],
  );
  const stepStatusByIndex = useMemo(
    () =>
      new Map(
        run?.stepStatuses.flatMap((item) =>
          typeof item.index === "number" ? ([[item.index, item]] as const) : [],
        ) ?? [],
      ),
    [run?.stepStatuses],
  );
  const stepStatusByNodeId = useMemo(
    () =>
      new Map(
        run?.stepStatuses.flatMap((item) =>
          item.nodeId ? ([[item.nodeId, item]] as const) : [],
        ) ?? [],
      ),
    [run?.stepStatuses],
  );
  const stepStatusByPath = useMemo(
    () =>
      new Map(
        run?.stepStatuses.flatMap((item) =>
          item.stepPath ? ([[item.stepPath, item]] as const) : [],
        ) ?? [],
      ),
    [run?.stepStatuses],
  );
  const statusForStep = useCallback(
    (step: WorkflowStep, index: number) => {
      const stepPath = pathPrefix ? `${pathPrefix}[${index}]` : undefined;
      return (
        (step.node_id ? stepStatusByNodeId.get(step.node_id) : undefined) ??
        (stepPath ? stepStatusByPath.get(stepPath) : undefined) ??
        (!pathPrefix ? stepStatusByIndex.get(index) : undefined)
      );
    },
    [pathPrefix, stepStatusByIndex, stepStatusByNodeId, stepStatusByPath],
  );
  const logsForStep = useCallback(
    (step: WorkflowStep, index: number) =>
      (runLogs ?? run?.logs ?? []).filter((log) => {
        if (step.node_id && log.nodeId) return log.nodeId === step.node_id;
        const stepPath = pathPrefix ? `${pathPrefix}[${index}]` : undefined;
        if (stepPath && log.stepPath) return log.stepPath === stepPath;
        return !pathPrefix && log.stepIndex === index;
      }),
    [pathPrefix, run?.logs, runLogs],
  );
  const selectStep = useCallback(
    (index: number) => {
      if (steps[index]?.type === "condition" && onConditionSelect) {
        onConditionSelect(index);
        return;
      }
      setSelectedIndex(index);
    },
    [onConditionSelect, steps],
  );
  const selectedVariables = useMemo(
    () =>
      selectedIndex === null
        ? inheritedVariables
        : variablesBeforeStep(steps, selectedIndex, inheritedVariables),
    [inheritedVariables, selectedIndex, steps],
  );
  const selectedHasWait = useMemo(
    () =>
      selectedIndex === null ? inheritedWait : waitBeforeStep(steps, selectedIndex, inheritedWait),
    [inheritedWait, selectedIndex, steps],
  );
  const move = useCallback(
    (index: number, directionValue: -1 | 1) => {
      const nextIndex = index + directionValue;
      if (nextIndex < 0 || nextIndex >= steps.length) return;
      const next = [...steps];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      emitChange(next);
    },
    [emitChange, steps],
  );
  const remove = useCallback(
    (index: number) => emitChange(steps.filter((_, stepIndex) => stepIndex !== index)),
    [emitChange, steps],
  );
  const add = useCallback(
    (type: string) => emitChange([...steps, makeStep(type)]),
    [emitChange, steps],
  );
  const insert = useCallback(
    (index: number, type: string) =>
      emitChange([...steps.slice(0, index), makeStep(type), ...steps.slice(index)]),
    [emitChange, steps],
  );
  const nodes = useMemo<WorkflowCanvasNode[]>(() => {
    const gap = isMobile ? 150 : 300;
    const stepOffset = isMobile ? 0 : 220;
    return [
      {
        id: "start",
        type: "display",
        position: isMobile ? { x: 40, y: 0 } : { x: 0, y: 60 },
        sourcePosition: Position.Right,
        data: { kind: "start" as const, label: "开始" },
        draggable: false,
      },
      ...steps.map((step, index) => {
        const stepStatus = statusForStep(step, index);
        return {
          id: `step-${index}`,
          type: "workflow" as const,
          position: isMobile
            ? { x: 40, y: (index + 1) * gap }
            : { x: stepOffset + index * gap, y: 60 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            index,
            stepCount: steps.length,
            step,
            selected: selectedIndex === index,
            runStatus: stepStatus?.status,
            durationMs: stepStatus?.durationMs,
            error: stepStatus?.error,
            botResponse: stepStatus?.botResponse,
            botButtons: stepStatus?.botButtons,
            readOnly,
            onSelect: selectStep,
            onMove: move,
            onDelete: remove,
          },
          draggable: false,
        };
      }),
      {
        id: "end",
        type: "display",
        position: isMobile
          ? { x: 40, y: (steps.length + 1) * gap }
          : { x: stepOffset + steps.length * gap, y: 60 },
        targetPosition: Position.Left,
        data: { kind: "end" as const, label: "结束" },
        draggable: false,
      },
    ];
  }, [isMobile, move, readOnly, remove, selectedIndex, selectStep, statusForStep, steps]);
  const edges = [
    { source: "start", target: steps.length > 0 ? "step-0" : "end", insertIndex: 0 },
    ...steps.slice(0, -1).map((_, index) => ({
      source: `step-${index}`,
      target: `step-${index + 1}`,
      insertIndex: index + 1,
    })),
    ...(steps.length > 0
      ? [{ source: `step-${steps.length - 1}`, target: "end", insertIndex: steps.length }]
      : []),
  ].map((edge, index) => ({
    ...edge,
    id: `edge-${index}`,
    type: "workflow",
    animated: run?.status === "running",
    data: { insertIndex: edge.insertIndex, readOnly, onInsert: insert },
  }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!readOnly && isMobile ? <StepTypeMenu onSelect={add} /> : null}
      </div>
      {!isMobile ? (
        <div className="h-[28rem] overflow-hidden rounded-xl border bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            fitView
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      ) : null}
      {isMobile || !readOnly ? (
        <div className="grid gap-3 md:hidden">
          <Card>
            <CardContent className="flex items-center gap-2 py-3 text-sm font-medium text-primary">
              <Play aria-hidden="true" />
              开始
            </CardContent>
          </Card>
          {steps.map((step, index) => {
            const stepStatus = statusForStep(step, index);
            const durationLabel = formatStepDuration(stepStatus?.durationMs);
            const stepLogs = logsForStep(step, index);
            return (
              <Card
                key={step.node_id ?? `${step.type}-${index}`}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => selectStep(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectStep(index);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <StepIcon step={step} className="size-4 shrink-0 text-primary" />
                    步骤 {index + 1} · {stepLabel(step)}
                    {runBadge(stepStatus?.status)}
                    {durationLabel ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {durationLabel}
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription>{stepSummary(step)}</CardDescription>
                  {stepStatus?.error ? (
                    <p className="text-xs text-destructive">{stepStatus.error}</p>
                  ) : null}
                  <BotResponsePreview
                    text={stepStatus?.botResponse}
                    buttons={stepStatus?.botButtons}
                    compact
                  />
                  {stepLogs.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {stepLogs.length} 条运行日志 · 点击查看
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {readOnly ? "点击查看节点详情" : "点击编辑步骤"}
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardContent className="flex items-center gap-2 py-3 text-sm font-medium text-muted-foreground">
              <Flag aria-hidden="true" />
              结束
            </CardContent>
          </Card>
        </div>
      ) : null}
      <StepEditorSheet
        step={selectedIndex === null ? null : (steps[selectedIndex] ?? null)}
        priorSteps={selectedIndex === null ? [] : steps.slice(0, selectedIndex)}
        index={selectedIndex ?? 0}
        open={selectedIndex !== null && steps[selectedIndex]?.type !== "condition"}
        readOnly={readOnly}
        runStatus={
          selectedIndex === null || !steps[selectedIndex]
            ? undefined
            : statusForStep(steps[selectedIndex], selectedIndex)
        }
        runLogs={
          selectedIndex === null || !steps[selectedIndex]
            ? []
            : logsForStep(steps[selectedIndex], selectedIndex)
        }
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
        onChange={(next) => {
          if (selectedIndex !== null)
            emitChange(steps.map((item, itemIndex) => (itemIndex === selectedIndex ? next : item)));
        }}
      />
      <ConditionWorkspace
        step={selectedIndex === null ? null : (steps[selectedIndex] ?? null)}
        open={selectedIndex !== null && steps[selectedIndex]?.type === "condition"}
        readOnly={readOnly}
        run={run}
        runLogs={runLogs}
        availableVariables={selectedVariables}
        hasPriorWait={selectedHasWait}
        runStatus={
          selectedIndex === null || !steps[selectedIndex]
            ? undefined
            : statusForStep(steps[selectedIndex], selectedIndex)
        }
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
        onApply={(next) => {
          if (selectedIndex !== null) {
            emitChange(steps.map((item, itemIndex) => (itemIndex === selectedIndex ? next : item)));
          }
        }}
        renderSequence={(props) => (
          <TaskWorkflowEditor
            steps={props.steps}
            onChange={props.onChange}
            readOnly={props.readOnly}
            run={props.run}
            runLogs={props.runLogs}
            onConditionSelect={props.onConditionSelect}
            inheritedVariables={props.inheritedVariables}
            inheritedWait={props.inheritedWait}
            pathPrefix={props.pathPrefix}
          />
        )}
      />
    </div>
  );
}

export function StepEditorSheet({
  step,
  index,
  open,
  onOpenChange,
  onChange,
  readOnly = false,
  runStatus,
  runLogs = [],
  priorSteps = [],
}: {
  step: WorkflowStep | null;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (step: WorkflowStep) => void;
  readOnly?: boolean;
  runStatus?: TaskStepStatus;
  runLogs?: TaskRunLog[];
  priorSteps?: WorkflowStep[];
}) {
  const [draftStep, setDraftStep] = useState<WorkflowStep | null>(step);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftStep(step);
      setFinishError(null);
    }
  }, [open, step]);

  const finishEditing = () => {
    if (!readOnly && draftStep) {
      const issues = validateStepConfiguration(draftStep, priorSteps);
      if (issues.length > 0) {
        setFinishError(issues.join("\n"));
        return;
      }
    }
    setFinishError(null);
    if (!readOnly && draftStep) onChange(draftStep);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle className="flex items-center gap-1.5">
            {step ? <StepIcon step={step} className="size-4 shrink-0 text-primary" /> : null}
            步骤 {index + 1} · {step ? stepLabel(step) : ""}
          </SheetTitle>
          <SheetDescription>
            {readOnly
              ? "查看该节点的执行状态和运行日志。"
              : "编辑该节点的执行参数。保存任务前会经过后端校验。"}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {readOnly ? (
            <RunStepDetails status={runStatus} logs={runLogs} />
          ) : draftStep ? (
            <StepFields
              step={draftStep}
              onChange={(next) => {
                setDraftStep(next);
                setFinishError(null);
              }}
              priorSteps={priorSteps}
            />
          ) : null}
        </div>
        <SheetFooter className="shrink-0 border-t">
          {finishError ? (
            <p role="alert" className="mr-auto whitespace-pre-line text-sm text-destructive">
              {finishError}
            </p>
          ) : null}
          <Button type="button" onClick={finishEditing}>
            <CheckCircle2 data-icon="inline-start" />
            {readOnly ? "关闭" : "完成编辑"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RunStepDetails({ status, logs }: { status?: TaskStepStatus; logs: TaskRunLog[] }) {
  const durationLabel = formatStepDuration(status?.durationMs);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">节点状态</span>
        <div className="flex items-center gap-2">
          {runBadge(status?.status) ?? <Badge variant="outline">暂无状态</Badge>}
          {durationLabel ? (
            <span className="text-xs tabular-nums text-muted-foreground">{durationLabel}</span>
          ) : null}
        </div>
      </div>
      {status?.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {status.error}
        </div>
      ) : null}
      {status?.botResponse || (status?.botButtons && status.botButtons.length > 0) ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">机器人回复</span>
          <TelegramMessagePreview text={status.botResponse} buttons={status.botButtons} />
        </div>
      ) : null}
      <div className="grid gap-2">
        <span className="text-xs text-muted-foreground">运行日志</span>
        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            暂无该节点日志
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border font-mono text-xs">
            {logs.map((log) => (
              <div
                key={`${log.timestamp}-${log.level}-${log.message}`}
                className="border-b px-3 py-2 last:border-b-0"
              >
                <div className="mb-1 flex gap-2 text-muted-foreground">
                  <time dateTime={log.timestamp ?? undefined}>{formatDateTime(log.timestamp)}</time>
                  <span>{log.level ?? "INFO"}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
