import { useEffect, useMemo, useState } from "react";
import { parse, stringify } from "yaml";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { ApiError } from "@/lib/api/client";
import type { Account, TaskDefinition, TaskRunProgress } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { TaskWorkflowEditor } from "./task-workflow-editor";
import { TaskTargetPicker } from "./task-target-picker";

const defaultDefinition: TaskDefinition = {
  name: "",
  account: "",
  target: "",
  schedule: { type: "fixed", timezone: "Asia/Shanghai", time: "08:00" },
  retry: { max_attempts: 3, backoff_seconds: [30, 60, 120] },
  steps: [{ type: "send_message", text: "/checkin" }],
  notifications: { failure: true, success: false },
  log_bot_response: false,
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
}) {
  const initial = useMemo(() => initialValue ?? defaultDefinition, [initialValue]);
  const [definition, setDefinition] = useState<TaskDefinition>(initial);
  const [yamlText, setYamlText] = useState(() => stringify(initial));
  const [mode, setMode] = useState("visual");
  const [visualMode, setVisualMode] = useState("edit");
  const [error, setError] = useState<string | null>(null);
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
                          key={JSON.stringify(step)}
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
                  支持 send_message、wait_message 和
                  click_button；桌面端横向排列，窄屏自动切换为纵向列表。
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
