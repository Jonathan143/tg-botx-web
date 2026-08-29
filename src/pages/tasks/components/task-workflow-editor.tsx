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
  type OnNodeDrag,
  Position,
  ReactFlow,
} from "@xyflow/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Flag,
  GripVertical,
  type LucideIcon,
  MessageCircle,
  MousePointerClick,
  Play,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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

import "@xyflow/react/dist/style.css";

export type WorkflowStep = Record<string, unknown> & { type?: string };

type WorkflowNodeData = {
  index: number;
  stepCount: number;
  step: WorkflowStep;
  selected: boolean;
  runStatus?: string | null;
  error?: string | null;
  botResponse?: string | null;
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
    const matcher = step.match ?? step.success;
    return matcher
      ? `匹配 ${typeof matcher === "string" ? matcher : "高级规则"}`
      : "等待任意新消息";
  }
  if (step.type === "click_button") {
    const callback = step.callback_data ?? step.callbackData;
    if (callback !== undefined) {
      return callback ? `定位 ${String(callback)}` : "待填写按钮定位条件";
    }
    const textContains = step.text_contains ?? step.textContains;
    if (textContains !== undefined) {
      return textContains ? `定位 ${String(textContains)}` : "待填写按钮定位条件";
    }
    if (step.text !== undefined) {
      return step.text ? `定位 ${String(step.text)}` : "待填写按钮定位条件";
    }
    if (step.row !== undefined || step.column !== undefined) {
      return `定位 行 ${String(step.row ?? "?")} · 列 ${String(step.column ?? "?")}`;
    }
    return "待填写按钮定位条件";
  }
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

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const invalid = data.step.type === "send_message" && typeof data.step.text !== "string";
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
        <div className="mt-0.5 cursor-grab text-muted-foreground" title="拖拽调整顺序">
          <GripVertical />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">步骤 {data.index + 1}</span>
            {runBadge(data.runStatus)}
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
          {data.botResponse !== undefined && data.botResponse !== null ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              机器人回复：{data.botResponse}
            </p>
          ) : null}
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
  if (type === "send_message") return { type, text: "" };
  if (type === "wait_message") return { type, timeout_seconds: 60 };
  if (type === "click_button") return { type, text: "" };
  return { type };
}

const BUTTON_FIELD_ALIASES: Record<string, string> = {
  text_contains: "textContains",
  callback_data: "callbackData",
};

function updateButtonField(
  step: WorkflowStep,
  onChange: (step: WorkflowStep) => void,
  field: "text" | "text_contains" | "callback_data" | "row" | "column",
  value: unknown,
) {
  const next = { ...step };
  const alias = BUTTON_FIELD_ALIASES[field];
  if (alias) delete next[alias];
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
          <div className="flex gap-2" key={`${id}-${mode}-${value}`}>
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
                onClick={() =>
                  updateMatcher(
                    values.filter((_, itemIndex) => itemIndex !== index),
                    mode,
                  )
                }
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

function StepFields({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
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
          description="支持包含、精确、正则和多个 OR 条件；留空表示任意新消息。"
          placeholder="留空表示任意新消息"
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
        : step.callbackData !== undefined
          ? "callback"
          : step.text_contains !== undefined || step.textContains !== undefined
          ? "contains"
          : step.text !== undefined
            ? "exact"
            : "position";
    const changeButtonMode = (mode: string) => {
      const {
        text: _text,
        text_contains: _textContains,
        textContains: _textContainsAlias,
        callback_data: _callbackData,
        callbackData: _callbackDataAlias,
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
              onChange={(event) =>
                updateButtonField(step, onChange, "text", event.target.value || undefined)
              }
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
              value={
                typeof step.text_contains === "string"
                  ? step.text_contains
                  : typeof step.textContains === "string"
                    ? step.textContains
                    : ""
              }
              onChange={(event) =>
                updateButtonField(step, onChange, "text_contains", event.target.value || undefined)
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
              value={
                typeof step.callback_data === "string"
                  ? step.callback_data
                  : typeof step.callbackData === "string"
                    ? step.callbackData
                    : ""
              }
              onChange={(event) =>
                updateButtonField(step, onChange, "callback_data", event.target.value || undefined)
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
  return <FieldError>该步骤类型暂不支持可视化编辑，请切换到 YAML 高级模式。</FieldError>;
}

export function TaskWorkflowEditor({
  steps,
  run,
  runLogs,
  onChange,
  readOnly = false,
}: {
  steps: WorkflowStep[];
  run?: TaskRunProgress | null;
  runLogs?: TaskRunLog[];
  onChange: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
}) {
  const isMobile = useIsMobile();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const stepStatusByIndex = useMemo(
    () => new Map(run?.stepStatuses.map((item) => [item.index, item]) ?? []),
    [run?.stepStatuses],
  );
  const move = useCallback(
    (index: number, directionValue: -1 | 1) => {
      const nextIndex = index + directionValue;
      if (nextIndex < 0 || nextIndex >= steps.length) return;
      const next = [...steps];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      onChange(next);
    },
    [onChange, steps],
  );
  const remove = useCallback(
    (index: number) => onChange(steps.filter((_, stepIndex) => stepIndex !== index)),
    [onChange, steps],
  );
  const add = useCallback(
    (type: string) => onChange([...steps, makeStep(type)]),
    [onChange, steps],
  );
  const insert = useCallback(
    (index: number, type: string) =>
      onChange([...steps.slice(0, index), makeStep(type), ...steps.slice(index)]),
    [onChange, steps],
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
        const stepStatus = stepStatusByIndex.get(index);
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
            error: stepStatus?.error,
            botResponse: stepStatus?.botResponse,
            readOnly,
            onSelect: setSelectedIndex,
            onMove: move,
            onDelete: remove,
          },
          draggable: !isMobile && !readOnly,
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
  }, [isMobile, move, readOnly, remove, selectedIndex, stepStatusByIndex, steps]);
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
  const handleNodeDragStop: OnNodeDrag<WorkflowCanvasNode> = (_event, node) => {
    if (isMobile || steps.length < 2) return;
    if (!("index" in node.data)) return;
    const center = node.position.x + 128;
    const nextIndex = Math.max(0, Math.min(steps.length - 1, Math.round((center - 348) / 300)));
    if (nextIndex === node.data.index) return;
    const next = [...steps];
    const [item] = next.splice(node.data.index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  };
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
            nodesDraggable={!isMobile && !readOnly}
            onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
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
            const stepStatus = stepStatusByIndex.get(index);
            const stepLogs = (runLogs ?? run?.logs ?? []).filter((log) => log.stepIndex === index);
            return (
              <Card
                key={JSON.stringify(step)}
                className={
                  readOnly ? "cursor-pointer transition-colors hover:bg-muted/40" : undefined
                }
                onClick={readOnly ? () => setSelectedIndex(index) : undefined}
                onKeyDown={
                  readOnly
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedIndex(index);
                        }
                      }
                    : undefined
                }
                role={readOnly ? "button" : undefined}
                tabIndex={readOnly ? 0 : undefined}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <StepIcon step={step} className="size-4 shrink-0 text-primary" />
                    步骤 {index + 1} · {stepLabel(step)}
                    {runBadge(stepStatus?.status)}
                  </CardTitle>
                  <CardDescription>{stepSummary(step)}</CardDescription>
                  {stepStatus?.error ? (
                    <p className="text-xs text-destructive">{stepStatus.error}</p>
                  ) : null}
                  {stepStatus?.botResponse !== undefined && stepStatus.botResponse !== null ? (
                    <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      机器人回复：{stepStatus.botResponse}
                    </p>
                  ) : null}
                  {stepLogs.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {stepLogs.length} 条运行日志 · 点击查看
                    </p>
                  ) : readOnly ? (
                    <p className="text-xs text-muted-foreground">点击查看节点详情</p>
                  ) : null}
                </CardHeader>
                {!readOnly ? (
                  <CardContent>
                    <StepFields
                      step={step}
                      onChange={(next) =>
                        onChange(
                          steps.map((item, itemIndex) => (itemIndex === index ? next : item)),
                        )
                      }
                    />
                  </CardContent>
                ) : null}
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
        index={selectedIndex ?? 0}
        open={selectedIndex !== null && (readOnly || !isMobile)}
        readOnly={readOnly}
        runStatus={selectedIndex === null ? undefined : stepStatusByIndex.get(selectedIndex)}
        runLogs={
          selectedIndex === null
            ? []
            : (runLogs ?? run?.logs ?? []).filter((log) => log.stepIndex === selectedIndex)
        }
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
        onChange={(next) => {
          if (selectedIndex !== null)
            onChange(steps.map((item, itemIndex) => (itemIndex === selectedIndex ? next : item)));
        }}
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
}: {
  step: WorkflowStep | null;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (step: WorkflowStep) => void;
  readOnly?: boolean;
  runStatus?: TaskStepStatus;
  runLogs?: TaskRunLog[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
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
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
          {readOnly ? (
            <RunStepDetails status={runStatus} logs={runLogs} />
          ) : step ? (
            <StepFields step={step} onChange={onChange} />
          ) : null}
        </div>
        <SheetFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            <CheckCircle2 data-icon="inline-start" />
            {readOnly ? "关闭" : "完成编辑"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RunStepDetails({ status, logs }: { status?: TaskStepStatus; logs: TaskRunLog[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">节点状态</span>
        <div>{runBadge(status?.status) ?? <Badge variant="outline">暂无状态</Badge>}</div>
      </div>
      {status?.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {status.error}
        </div>
      ) : null}
      {status?.botResponse ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">机器人回复</span>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">
            {status.botResponse}
          </pre>
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
