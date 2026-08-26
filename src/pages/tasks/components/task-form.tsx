import { useEffect, useMemo, useState } from "react";
import { parse, stringify } from "yaml";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
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
import type { Account, TaskDefinition } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { TaskWorkflowEditor } from "./task-workflow-editor";

const defaultDefinition: TaskDefinition = {
  name: "",
  account: "default",
  target: "",
  schedule: { type: "fixed", timezone: "Asia/Shanghai", time: "08:00" },
  retry: { maxAttempts: 3, backoffSeconds: [30, 60, 120] },
  steps: [{ type: "send_message", text: "/checkin" }],
  notifications: { failure: true, success: false },
  outputBotResponse: false,
};

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
  onSubmit,
}: {
  initialValue?: TaskDefinition;
  accounts?: Account[];
  accountsLoading?: boolean;
  accountsError?: boolean;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (definition: TaskDefinition) => Promise<void>;
}) {
  const initial = useMemo(() => initialValue ?? defaultDefinition, [initialValue]);
  const [definition, setDefinition] = useState<TaskDefinition>(initial);
  const [yamlText, setYamlText] = useState(() => stringify(initial));
  const [mode, setMode] = useState("visual");
  const [visualMode, setVisualMode] = useState("edit");
  const [error, setError] = useState<string | null>(null);
  const isDirty =
    mode === "yaml"
      ? yamlText !== stringify(initial)
      : stringify(definition) !== stringify(initial);

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
    setDefinition(initial);
    setYamlText(stringify(initial));
  }, [initial]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const next = mode === "yaml" ? (parse(yamlText) as TaskDefinition) : definition;
      if (!next.name?.trim() || !next.account?.trim() || !next.target?.trim()) {
        throw new Error("任务名称、账号和目标不能为空。");
      }
      if (!Array.isArray(next.steps) || next.steps.length === 0) {
        throw new Error("至少需要配置一个执行步骤。");
      }
      await onSubmit(next);
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList>
          <TabsTrigger value="visual">可视化配置</TabsTrigger>
          <TabsTrigger value="yaml">YAML 高级模式</TabsTrigger>
        </TabsList>
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
              <Input
                id="task-target"
                value={definition.target}
                onChange={(event) =>
                  updateDefinition({ ...definition, target: event.target.value })
                }
                placeholder="用户名、链接或对话 ID"
              />
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
          </FieldGroup>
        </TabsContent>
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
      </Tabs>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>无法保存配置</AlertTitle>
          <AlertDescription>
            <FieldError className="whitespace-pre-wrap">{error}</FieldError>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
