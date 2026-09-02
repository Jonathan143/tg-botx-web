import { useEffect, useMemo, useState } from "react";
import { parse, stringify } from "yaml";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError, apiRequest, jsonBody } from "@/lib/api/client";
import type {
  Account,
  MessageProbeResponse,
  SchedulePreview,
  TaskDefinition,
  TaskRunProgress,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { createWorkflowStep, normalizeConditionStep } from "@/lib/workflow-condition";
import { TaskTargetPicker } from "./task-target-picker";
import { TaskWorkflowEditor } from "./task-workflow-editor";

const defaultDefinition: TaskDefinition = {
  name: "",
  account: "",
  target: "",
  schedule: {
    type: "fixed",
    timezone: "Asia/Shanghai",
    frequency: "daily",
    start_date: new Date().toISOString().slice(0, 10),
    time: "08:00",
  },
  retry: { max_attempts: 1, backoff_seconds: [30, 60, 120] },
  steps: [{ ...createWorkflowStep("send_message"), text: "/start" }],
  notifications: { failure: true, success: false },
  log_bot_response: false,
  log_condition_values: false,
  notify_bot_response: false,
};

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function definitionsEqual(first: TaskDefinition, second: TaskDefinition): boolean {
  return stableSerialize(first) === stableSerialize(second);
}

const commonTimezones = [
  { value: "Asia/Shanghai", label: "中国标准时间（Asia/Shanghai）" },
  { value: "Asia/Tokyo", label: "日本标准时间（Asia/Tokyo）" },
  { value: "Asia/Singapore", label: "新加坡时间（Asia/Singapore）" },
  { value: "Asia/Kolkata", label: "印度标准时间（Asia/Kolkata）" },
  { value: "UTC", label: "协调世界时（UTC）" },
  { value: "Europe/London", label: "英国时间（Europe/London）" },
  { value: "Europe/Berlin", label: "中欧时间（Europe/Berlin）" },
  { value: "America/New_York", label: "美国东部时间（America/New_York）" },
  { value: "America/Los_Angeles", label: "美国太平洋时间（America/Los_Angeles）" },
];

const frequencyOptions: Array<{
  value: NonNullable<TaskDefinition["schedule"]["frequency"]>;
  label: string;
}> = [
  { value: "daily", label: "每天" },
  { value: "every_n_days", label: "每 N 天" },
  { value: "weekly", label: "每周" },
  { value: "monthly_dates", label: "每月固定日期" },
];

export function TaskForm({
  initialValue,
  accounts,
  accountsLoading = false,
  accountsError = false,
  submitLabel,
  isSubmitting,
  onTest,
  isTesting = false,
  run,
  onSubmit,
  onCancel,
  showWorkflow = true,
  footerClassName,
  formId,
  hideFooter = false,
  taskId,
}: {
  initialValue?: TaskDefinition;
  accounts?: Account[];
  accountsLoading?: boolean;
  accountsError?: boolean;
  submitLabel: string;
  isSubmitting: boolean;
  onTest?: (definition: TaskDefinition) => Promise<void>;
  isTesting?: boolean;
  run?: TaskRunProgress | null;
  onSubmit: (definition: TaskDefinition) => Promise<void>;
  onCancel?: () => void;
  showWorkflow?: boolean;
  footerClassName?: string;
  formId?: string;
  hideFooter?: boolean;
  taskId?: string;
}) {
  const initial = useMemo(() => initialValue ?? defaultDefinition, [initialValue]);
  const [definition, setDefinition] = useState<TaskDefinition>(initial);
  const [yamlText, setYamlText] = useState(() => stringify(initial));
  const [mode, setMode] = useState("visual");
  const [visualMode, setVisualMode] = useState("edit");
  const [error, setError] = useState<string | null>(null);
  const [probeText, setProbeText] = useState("");
  const [probeResult, setProbeResult] = useState<MessageProbeResponse | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const isDirty = (() => {
    if (mode !== "yaml") return !definitionsEqual(definition, initial);
    try {
      const parsed = parse(yamlText) as TaskDefinition;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) return true;
      return !definitionsEqual(parsed, initial);
    } catch {
      return true;
    }
  })();

  const accountOptions = useMemo(() => {
    if (accounts === undefined) {
      return definition.account
        ? [{ id: definition.account, name: definition.account, active: true }]
        : [];
    }

    const activeAccounts = accounts.filter((account) => account.active);
    const selectedAccount = accounts.find((account) => account.name === definition.account);
    if (selectedAccount && !selectedAccount.active) {
      return [selectedAccount, ...activeAccounts];
    }
    return activeAccounts;
  }, [accounts, definition.account]);

  const selectedAccount = useMemo(
    () => accounts?.find((account) => account.name === definition.account),
    [accounts, definition.account],
  );

  const accountSelectItems = useMemo(
    () =>
      accountOptions.map((account) => ({
        value: account.name,
        label: `${account.name}${account.active ? "" : "（已停用）"}`,
      })),
    [accountOptions],
  );

  const timezoneOptions = useMemo(() => {
    const currentTimezone = definition.schedule.timezone;
    if (commonTimezones.some((timezone) => timezone.value === currentTimezone)) {
      return commonTimezones;
    }
    return [
      { value: currentTimezone, label: `当前配置（${currentTimezone}）` },
      ...commonTimezones,
    ];
  }, [definition.schedule.timezone]);

  useEffect(() => {
    // Execution events refresh the task snapshot while an unsaved draft may be
    // open. Keep that draft visible so run step statuses stay aligned with the
    // workflow that was actually tested; saved snapshots still rehydrate when
    // the form is clean.
    if (isDirty) return;
    setDefinition(initial);
    setYamlText(stringify(initial));
  }, [initial, isDirty]);

  useEffect(() => {
    // 新建任务在账号列表异步加载完成后，仅在只有一个可用账号时自动选择。
    // 编辑任务已有账号配置，不因账号列表刷新而覆盖用户的选择。
    if (initialValue !== undefined || !accounts || mode === "yaml" || definition.account) return;
    const activeAccounts = accounts.filter((account) => account.active);
    if (activeAccounts.length !== 1) return;
    const next = { ...definition, account: activeAccounts[0].name };
    setDefinition(next);
    setYamlText(stringify(next));
  }, [accounts, definition, initialValue, mode]);

  useEffect(() => {
    if (probeText) return;
    const firstMessage = definition.steps.find(
      (step) => step.type === "send_message" && typeof step.text === "string" && step.text,
    );
    if (firstMessage && typeof firstMessage.text === "string") setProbeText(firstMessage.text);
  }, [definition.steps, probeText]);

  const updateDefinition = (next: TaskDefinition) => {
    setDefinition(next);
    setYamlText(stringify(next));
    setError(null);
  };

  const handleModeChange = (nextMode: string) => {
    if (nextMode === "visual" && mode === "yaml") {
      try {
        const parsed = parse(yamlText) as TaskDefinition;
        if (!parsed || typeof parsed !== "object") throw new Error("YAML 必须是对象。");
        setDefinition(parsed);
        setYamlText(stringify(parsed));
        setError(null);
      } catch (parseError) {
        setError(
          parseError instanceof Error ? `YAML 解析失败：${parseError.message}` : "YAML 解析失败。",
        );
        return;
      }
    }
    setMode(nextMode);
  };

  const readDefinition = () => {
    const parsed = mode === "yaml" ? (parse(yamlText) as TaskDefinition) : definition;
    const next: TaskDefinition = {
      ...parsed,
      retry: {
        max_attempts: parsed.retry?.max_attempts ?? 3,
        backoff_seconds: parsed.retry?.backoff_seconds ?? [30, 60, 120],
      },
    };
    if (!next.name?.trim() || !next.account?.trim() || !next.target?.trim()) {
      throw new Error("任务名称、账号和目标不能为空。");
    }
    if (!Array.isArray(next.steps) || next.steps.length === 0) {
      throw new Error("至少需要配置一个执行步骤。");
    }
    if (
      !Number.isInteger(next.retry.max_attempts) ||
      next.retry.max_attempts < 1 ||
      next.retry.max_attempts > 10
    ) {
      throw new Error("最大尝试次数必须是 1–10 之间的整数。");
    }
    if (
      !Array.isArray(next.retry.backoff_seconds) ||
      next.retry.backoff_seconds.some((value) => !Number.isInteger(value) || value < 0)
    ) {
      throw new Error("重试等待时间必须是非负整数列表。");
    }
    return next;
  };

  const handleAction = async (
    event: React.SyntheticEvent,
    action: (next: TaskDefinition) => Promise<void>,
  ) => {
    event.preventDefault();
    setError(null);
    try {
      await action(readDefinition());
    } catch (submissionError) {
      if (submissionError instanceof ApiError && Array.isArray(submissionError.details)) {
        const details = submissionError.details
          .map((detail) => {
            if (!detail || typeof detail !== "object") return null;
            const item = detail as { path?: unknown; message?: unknown };
            return `${Array.isArray(item.path) ? item.path.join(".") : "配置"}：${String(item.message ?? "无效")}`;
          })
          .filter(Boolean)
          .join("\n");
        setError(details || submissionError.message);
      } else {
        setError(submissionError instanceof Error ? submissionError.message : "配置格式无效。");
      }
    }
  };

  const handleSubmit = (event: React.FormEvent) => handleAction(event, onSubmit);
  const handleTest = (event: React.MouseEvent<HTMLButtonElement>) =>
    onTest ? handleAction(event, onTest) : Promise.resolve();

  const probeButtons = async () => {
    if (!selectedAccount?.id || !definition.target.trim()) {
      setProbeError("请先选择 Telegram 账号和目标聊天。");
      return;
    }
    if (!probeText.trim()) {
      setProbeError("请输入要发送的指令。");
      return;
    }
    setIsProbing(true);
    setProbeError(null);
    setProbeResult(null);
    try {
      const result = await apiRequest<MessageProbeResponse>(
        `/api/accounts/${selectedAccount.id}/messages/probe`,
        { method: "POST", body: jsonBody({ target: definition.target, text: probeText }) },
      );
      setProbeResult(result);
    } catch (probeRequestError) {
      setProbeError(
        probeRequestError instanceof Error
          ? probeRequestError.message
          : "获取按钮失败，请稍后重试。",
      );
    } finally {
      setIsProbing(false);
    }
  };

  const previewSchedule = async () => {
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const result = await apiRequest<SchedulePreview>(
        taskId ? `/api/tasks/${taskId}/preview` : "/api/tasks/preview",
        { method: "POST", body: jsonBody({ definition }) },
      );
      setPreview(result);
    } catch (previewRequestError) {
      setPreviewError(
        previewRequestError instanceof Error
          ? previewRequestError.message
          : "预览失败，请检查调度配置。",
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Tabs value={mode} onValueChange={handleModeChange}>
        {showWorkflow ? (
          <TabsList>
            <TabsTrigger value="visual">可视化配置</TabsTrigger>
            <TabsTrigger value="yaml">YAML 高级模式</TabsTrigger>
          </TabsList>
        ) : null}
        {isDirty ? <p className="mt-2 text-xs text-amber-600">有未保存的更改</p> : null}
        <TabsContent value="visual" className="pt-5">
          <FieldGroup>
            <div className="grid gap-5 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="task-name">任务名称</FieldLabel>
                <Input
                  id="task-name"
                  value={definition.name}
                  onChange={(event) =>
                    updateDefinition({ ...definition, name: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-account">Telegram 账号</FieldLabel>
                <Select
                  items={accountSelectItems}
                  value={definition.account}
                  onValueChange={(value) =>
                    updateDefinition({ ...definition, account: value ?? "" })
                  }
                  disabled={accountsLoading || accountOptions.length === 0}
                >
                  <SelectTrigger id="task-account" className="w-full">
                    <SelectValue
                      placeholder={accountsLoading ? "正在加载账号…" : "请选择 Telegram 账号"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accountOptions.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.name}
                          disabled={!account.active}
                        >
                          {account.name}
                          {!account.active ? "（已停用）" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {accountsLoading
                    ? "正在加载可用账号…"
                    : accountsError
                      ? "账号列表加载失败，请刷新后重试。"
                      : accountOptions.length === 0
                        ? "暂无可用账号，请先登录 Telegram 账号。"
                        : "每个任务当前只能绑定一个 Telegram 账号。"}
                </FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="task-target">目标聊天</FieldLabel>
              <TaskTargetPicker
                account={selectedAccount}
                target={definition.target}
                onTargetChange={(target) => updateDefinition({ ...definition, target })}
              />
              <FieldDescription>
                {selectedAccount
                  ? "点击上方目标卡片，在弹框中远程搜索并筛选对话。"
                  : "先选择 Telegram 账号，再选择目标聊天。"}
              </FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend>按钮探测</FieldLegend>
              <FieldDescription>
                向当前目标发送一条指令，读取机器人回复中的按钮文字、行列位置和 callback_data。
                这会真实发送 Telegram 消息。
              </FieldDescription>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={probeText}
                  onChange={(event) => setProbeText(event.target.value)}
                  placeholder="例如：/start"
                  disabled={!selectedAccount?.active || !definition.target.trim() || isProbing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void probeButtons()}
                  disabled={!selectedAccount?.active || !definition.target.trim() || isProbing}
                >
                  {isProbing ? <Spinner data-icon="inline-start" /> : null}
                  获取消息与按钮
                </Button>
              </div>
              {probeError ? <FieldError>{probeError}</FieldError> : null}
              {probeResult ? (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="whitespace-pre-wrap break-words">
                    {probeResult.text || "（无文本）"}
                  </p>
                  {probeResult.buttons.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {probeResult.buttons.map((button) => (
                        <div
                          key={`${button.row}-${button.column}-${button.text}`}
                          className="grid gap-1 rounded-md border bg-background p-2 sm:grid-cols-[auto_1fr] sm:items-center"
                        >
                          <span className="font-medium">
                            {button.text || "（无文字）"} · 行 {button.row} / 列 {button.column}
                          </span>
                          <code className="select-all break-all text-xs text-muted-foreground">
                            {button.callbackData ?? "非回调按钮"}
                          </code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">回复中没有可识别的按钮。</p>
                  )}
                </div>
              ) : null}
            </FieldSet>
            <FieldSet>
              <FieldLegend>调度</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel>执行时间类型</FieldLabel>
                  <ToggleGroup
                    value={[definition.schedule.type]}
                    onValueChange={(values) =>
                      values[0] &&
                      updateDefinition({
                        ...definition,
                        schedule: { ...definition.schedule, type: values[0] as "fixed" | "random" },
                      })
                    }
                  >
                    <ToggleGroupItem value="fixed">固定时间</ToggleGroupItem>
                    <ToggleGroupItem value="random">随机窗口</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="timezone">时区</FieldLabel>
                    <Select
                      items={timezoneOptions}
                      value={definition.schedule.timezone}
                      onValueChange={(value) =>
                        updateDefinition({
                          ...definition,
                          schedule: { ...definition.schedule, timezone: value ?? "" },
                        })
                      }
                    >
                      <SelectTrigger id="timezone" className="w-full">
                        <SelectValue placeholder="请选择时区" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {timezoneOptions.map((timezone) => (
                            <SelectItem key={timezone.value} value={timezone.value}>
                              {timezone.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {definition.schedule.type === "fixed" ? (
                    <Field>
                      <FieldLabel htmlFor="fixed-time">执行时间</FieldLabel>
                      <Input
                        id="fixed-time"
                        type="time"
                        value={definition.schedule.time ?? ""}
                        onChange={(event) =>
                          updateDefinition({
                            ...definition,
                            schedule: { ...definition.schedule, time: event.target.value },
                          })
                        }
                      />
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="start-time">开始时间</FieldLabel>
                        <Input
                          id="start-time"
                          type="time"
                          value={definition.schedule.start ?? ""}
                          onChange={(event) =>
                            updateDefinition({
                              ...definition,
                              schedule: { ...definition.schedule, start: event.target.value },
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="end-time">结束时间</FieldLabel>
                        <Input
                          id="end-time"
                          type="time"
                          value={definition.schedule.end ?? ""}
                          onChange={(event) =>
                            updateDefinition({
                              ...definition,
                              schedule: { ...definition.schedule, end: event.target.value },
                            })
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="frequency">执行频率</FieldLabel>
                    <Select
                      items={frequencyOptions}
                      value={definition.schedule.frequency ?? "daily"}
                      onValueChange={(value) =>
                        updateDefinition({
                          ...definition,
                          schedule: {
                            ...definition.schedule,
                            frequency: (value ?? "daily") as NonNullable<
                              TaskDefinition["schedule"]["frequency"]
                            >,
                            interval_days:
                              value === "every_n_days"
                                ? (definition.schedule.interval_days ?? 2)
                                : undefined,
                            weekdays:
                              value === "weekly"
                                ? (definition.schedule.weekdays ?? [1])
                                : undefined,
                            month_days:
                              value === "monthly_dates"
                                ? (definition.schedule.month_days ?? [1])
                                : undefined,
                          },
                        })
                      }
                    >
                      <SelectTrigger id="frequency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {frequencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="start-date">开始日期</FieldLabel>
                    <Input
                      id="start-date"
                      type="date"
                      value={definition.schedule.start_date ?? ""}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          schedule: {
                            ...definition.schedule,
                            start_date: event.target.value || null,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="end-date">结束日期（可选）</FieldLabel>
                    <Input
                      id="end-date"
                      type="date"
                      value={definition.schedule.end_date ?? ""}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          schedule: {
                            ...definition.schedule,
                            end_date: event.target.value || null,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
                {(definition.schedule.frequency ?? "daily") === "every_n_days" ? (
                  <Field>
                    <FieldLabel htmlFor="interval-days">间隔天数（1–365）</FieldLabel>
                    <Input
                      id="interval-days"
                      type="number"
                      min={1}
                      max={365}
                      value={definition.schedule.interval_days ?? 2}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          schedule: {
                            ...definition.schedule,
                            interval_days: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ) : null}
                {(definition.schedule.frequency ?? "daily") === "weekly" ? (
                  <Field>
                    <FieldLabel>选择星期（至少一天）</FieldLabel>
                    <div className="flex flex-wrap gap-3">
                      {[
                        [1, "周一"],
                        [2, "周二"],
                        [3, "周三"],
                        [4, "周四"],
                        [5, "周五"],
                        [6, "周六"],
                        [7, "周日"],
                      ].map(([day, label]) => {
                        const selected = (definition.schedule.weekdays ?? []).includes(
                          day as number,
                        );
                        return (
                          <label key={day} className="flex items-center gap-1 text-sm">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const next = new Set(definition.schedule.weekdays ?? []);
                                checked === true
                                  ? next.add(day as number)
                                  : next.delete(day as number);
                                updateDefinition({
                                  ...definition,
                                  schedule: {
                                    ...definition.schedule,
                                    weekdays: [...next].sort((a, b) => a - b),
                                  },
                                });
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                ) : null}
                {(definition.schedule.frequency ?? "daily") === "monthly_dates" ? (
                  <Field>
                    <FieldLabel htmlFor="month-days">每月日期（逗号分隔，1–31）</FieldLabel>
                    <Input
                      id="month-days"
                      value={(definition.schedule.month_days ?? [1]).join(",")}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          schedule: {
                            ...definition.schedule,
                            month_days: event.target.value
                              .split(",")
                              .map((value) => Number(value.trim()))
                              .filter((value) => Number.isFinite(value)),
                          },
                        })
                      }
                    />
                  </Field>
                ) : null}
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <FieldLabel>后续 5 次执行预览</FieldLabel>
                      <p className="text-xs text-muted-foreground">
                        按任务时区计算，不会改变任务状态。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void previewSchedule()}
                      disabled={isPreviewing}
                    >
                      {isPreviewing ? <Spinner data-icon="inline-start" /> : null}刷新预览
                    </Button>
                  </div>
                  {previewError ? <FieldError>{previewError}</FieldError> : null}
                  {preview ? (
                    <div className="mt-2 rounded-md border bg-muted/20 p-3 text-sm">
                      {preview.items.length ? (
                        <ol className="grid gap-1">
                          {preview.items.map((item, index) => (
                            <li key={item}>
                              {index + 1}.{" "}
                              {new Date(item).toLocaleString("zh-CN", {
                                timeZone: preview.timezone,
                              })}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <span className="text-muted-foreground">没有可执行的未来时间。</span>
                      )}
                    </div>
                  ) : null}
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend>失败重试</FieldLegend>
              <FieldGroup>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="retry-max-attempts">最大尝试次数</FieldLabel>
                    <Input
                      id="retry-max-attempts"
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={definition.retry.max_attempts}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          retry: {
                            ...definition.retry,
                            max_attempts: Number(event.target.value),
                          },
                        })
                      }
                    />
                    <FieldDescription>包含首次执行，取值范围为 1–10 次。</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="retry-backoff-seconds">重试等待时间（秒）</FieldLabel>
                    <Input
                      id="retry-backoff-seconds"
                      value={definition.retry.backoff_seconds.join(", ")}
                      onChange={(event) =>
                        updateDefinition({
                          ...definition,
                          retry: {
                            ...definition.retry,
                            backoff_seconds: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean)
                              .map((value) => Number(value))
                              .filter((value) => Number.isFinite(value)),
                          },
                        })
                      }
                      placeholder="30, 60, 120"
                    />
                    <FieldDescription>
                      按第 N 次重试顺序填写非负整数，使用逗号分隔；留空则立即重试。
                    </FieldDescription>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
            {showWorkflow ? (
              <FieldSet>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FieldLegend>执行步骤</FieldLegend>
                  <ToggleGroup
                    value={[visualMode]}
                    onValueChange={(values) => values[0] && setVisualMode(values[0])}
                  >
                    <ToggleGroupItem value="edit">编辑</ToggleGroupItem>
                    <ToggleGroupItem value="preview">预览</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {visualMode === "edit" ? (
                  <TaskWorkflowEditor
                    steps={definition.steps}
                    run={run}
                    onChange={(steps) => updateDefinition({ ...definition, steps })}
                  />
                ) : (
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <span className="size-2 rounded-full bg-primary" />
                      预计执行顺序
                    </div>
                    <ol className="flex flex-col gap-3">
                      {definition.steps.map((step, index) => (
                        <li
                          key={step.node_id ?? `${step.type}-${index}`}
                          className="flex items-start gap-3 rounded-lg border bg-card p-3"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{String(step.type ?? "未知步骤")}</p>
                            <p className="text-sm text-muted-foreground">
                              {step.type === "send_message"
                                ? String(step.text || "待填写消息文本")
                                : step.type === "wait_message"
                                  ? "等待匹配消息或超时"
                                  : step.type === "click_button"
                                    ? "点击当前消息中的按钮"
                                    : step.type === "condition"
                                      ? (() => {
                                          const condition = normalizeConditionStep(step);
                                          return `提取 ${condition.extracts.length} 个变量，按 ${condition.branches.length} 个 if / else 分支执行`;
                                        })()
                                      : "请使用 YAML 高级模式配置"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-4 text-xs text-muted-foreground">
                      预览不会向 Telegram 发送消息。点击“{submitLabel}”后才会保存配置。
                    </p>
                  </div>
                )}
                <FieldDescription>
                  支持发送、等待、点击与条件判断节点；条件节点在全屏工作区中配置 if / else
                  分支，桌面端横向排列，窄屏自动切换为纵向列表。
                </FieldDescription>
              </FieldSet>
            ) : null}
            <FieldSet>
              <FieldLegend>通知</FieldLegend>
              <FieldGroup className="flex-row">
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor="notify-failure">失败时通知</FieldLabel>
                  <Switch
                    id="notify-failure"
                    checked={definition.notifications.failure}
                    onCheckedChange={(checked) =>
                      updateDefinition({
                        ...definition,
                        notifications: { ...definition.notifications, failure: checked },
                      })
                    }
                  />
                </Field>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor="notify-success">成功时通知</FieldLabel>
                  <Switch
                    id="notify-success"
                    checked={definition.notifications.success}
                    onCheckedChange={(checked) =>
                      updateDefinition({
                        ...definition,
                        notifications: { ...definition.notifications, success: checked },
                      })
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend>机器人回复</FieldLegend>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="log-bot-response">记录机器人回复</FieldLabel>
                    <FieldDescription>
                      将机器人最后一次回复写入运行日志，回复可能包含敏感信息。
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="log-bot-response"
                    checked={definition.log_bot_response ?? false}
                    onCheckedChange={(checked) =>
                      updateDefinition({ ...definition, log_bot_response: checked })
                    }
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="log-condition-values">记录条件变量值</FieldLabel>
                    <FieldDescription>
                      将条件节点提取到的变量值写入运行状态；默认关闭，变量可能包含敏感信息。
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="log-condition-values"
                    checked={definition.log_condition_values ?? false}
                    onCheckedChange={(checked) =>
                      updateDefinition({ ...definition, log_condition_values: checked })
                    }
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="notify-bot-response">通知中包含机器人回复</FieldLabel>
                    <FieldDescription>
                      在任务结果通知中附带机器人最后一次回复，回复可能包含敏感信息。
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="notify-bot-response"
                    checked={definition.notify_bot_response ?? false}
                    onCheckedChange={(checked) =>
                      updateDefinition({ ...definition, notify_bot_response: checked })
                    }
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </TabsContent>
        {showWorkflow ? (
          <TabsContent value="yaml" className="pt-5">
            <Field>
              <FieldLabel htmlFor="task-yaml">TaskDefinition YAML</FieldLabel>
              <Textarea
                id="task-yaml"
                className="min-h-[32rem] font-mono text-xs"
                value={yamlText}
                onChange={(event) => {
                  setYamlText(event.target.value);
                  setError(null);
                }}
              />
              <FieldDescription>保存前会经过与 CLI 相同的后端模型校验。</FieldDescription>
            </Field>
          </TabsContent>
        ) : null}
      </Tabs>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>配置操作失败</AlertTitle>
          <AlertDescription>
            <FieldError className="whitespace-pre-wrap">{error}</FieldError>
          </AlertDescription>
        </Alert>
      ) : null}
      {!hideFooter ? (
        <div className={cn("flex justify-end gap-2", footerClassName)}>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isTesting}
            >
              取消
            </Button>
          ) : null}
          {onTest ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isTesting}
              onClick={(event) => void handleTest(event)}
            >
              {isTesting ? <Spinner data-icon="inline-start" /> : null}
              测试工作流
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting || isTesting}>
            {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            {submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
