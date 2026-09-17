import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { MessageListEditor } from "@/components/message-list-editor";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { messageLibraryApi, messageLibraryKey } from "@/lib/api/message-library";
import { MAX_MESSAGES, validateMessageList } from "@/lib/message-library";
import type { WorkflowStep } from "@/lib/workflow-condition";

export function SendMessageFields({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
}) {
  const id = useId();
  const isRandom = step.message_mode === "random";
  const isLive = step.random_source === "group";
  const messages = Array.isArray(step.messages)
    ? step.messages.map((value) => (typeof value === "string" ? value : ""))
    : [];
  const [importGroup, setImportGroup] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRequest = useRef<AbortController | null>(null);
  const latestStep = useRef(step);
  latestStep.current = step;
  const drafts = useRef({ text: "", messages: [] as string[], groupId: "" });
  useEffect(() => () => importRequest.current?.abort(), []);
  const query = useQuery({
    queryKey: [...messageLibraryKey, "groups"],
    queryFn: ({ signal }) => messageLibraryApi.list(signal),
    enabled: isRandom,
    staleTime: 0,
  });
  const groups = query.data?.items ?? [];
  const selectedId = isLive ? String(step.message_group_id ?? "") : importGroup;
  const groupOptions = groups.map((group) => ({
    value: group.id,
    label: `${group.name}（${group.messageCount} 条）`,
  }));
  if (selectedId && !groups.some((group) => group.id === selectedId)) {
    groupOptions.push({
      value: selectedId,
      label: query.isPending ? "正在加载分组…" : "分组不可用，请重新选择",
    });
  }
  const changeSource = (random: boolean, live: boolean) => {
    if (!isRandom) drafts.current.text = typeof step.text === "string" ? step.text : "";
    else if (isLive) drafts.current.groupId = String(step.message_group_id ?? "");
    else drafts.current.messages = messages;
    const next = { ...step };
    for (const key of ["text", "message_mode", "random_source", "messages", "message_group_id"])
      delete next[key];
    if (!random) next.text = drafts.current.text;
    else {
      next.message_mode = "random";
      next.random_source = live ? "group" : "manual";
      if (live) next.message_group_id = drafts.current.groupId;
      else
        next.messages = drafts.current.messages.length
          ? drafts.current.messages
          : drafts.current.text
            ? [drafts.current.text]
            : [];
    }
    setError(null);
    setNotice(null);
    onChange(next);
  };
  const importSnapshot = async () => {
    if (!importGroup || isImporting) return;
    const controller = new AbortController();
    importRequest.current = controller;
    setIsImporting(true);
    setError(null);
    setNotice(null);
    try {
      // Always fetch the group now; a snapshot must not use stale query-cache content.
      const group = await messageLibraryApi.get(importGroup, controller.signal);
      if (controller.signal.aborted) return;
      const current = latestStep.current;
      if (current.message_mode !== "random" || current.random_source === "group") return;
      const existing = Array.isArray(current.messages) ? (current.messages as string[]) : [];
      const incomingIssues = validateMessageList(group.messages);
      if (incomingIssues.length) throw new Error(incomingIssues[0]);
      if (existing.length + group.messages.length > MAX_MESSAGES)
        throw new Error("导入后超过 1000 条，请先减少消息数量。");
      onChange({ ...current, messages: [...existing, ...group.messages] });
      setNotice(`已从“${group.name}”追加 ${group.messages.length} 条独立消息，不再随分组更新。`);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "导入失败，请重试。");
    } finally {
      if (!controller.signal.aborted) setIsImporting(false);
    }
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>消息类型</FieldLabel>
        <ToggleGroup
          value={[isRandom ? "random" : "fixed"]}
          disabled={isImporting}
          onValueChange={(values) => values[0] && changeSource(values[0] === "random", isLive)}
        >
          <ToggleGroupItem value="fixed">固定消息</ToggleGroupItem>
          <ToggleGroupItem value="random">随机消息</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      {!isRandom ? (
        <Field>
          <FieldLabel htmlFor={`${id}-text`}>消息文本</FieldLabel>
          <Textarea
            id={`${id}-text`}
            value={typeof step.text === "string" ? step.text : ""}
            onChange={(event) => onChange({ ...step, text: event.target.value })}
            placeholder="输入要发送的消息"
          />
          <FieldDescription>
            支持多行文本与上游变量模板，每条最多 4096 个 UTF-16 字符单位。
          </FieldDescription>
        </Field>
      ) : (
        <>
          <Field>
            <FieldLabel>随机消息来源</FieldLabel>
            <ToggleGroup
              value={[isLive ? "group" : "manual"]}
              disabled={isImporting}
              onValueChange={(values) => values[0] && changeSource(true, values[0] === "group")}
            >
              <ToggleGroupItem value="manual">手动列表</ToggleGroupItem>
              <ToggleGroupItem value="group">实时分组</ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              {isLive
                ? "每次发送前读取分组最新内容，再随机选择一条。分组更新立即影响后续发送，无需重新发布任务。"
                : "独立保存在任务中。可手动编辑或一次性从消息库导入，后续不随分组更新。"}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-group`}>
              {isLive ? "引用消息分组" : "从消息库导入（可选）"}
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Select
                items={groupOptions}
                value={selectedId || null}
                disabled={query.isPending || isImporting}
                onValueChange={(value) =>
                  isLive
                    ? onChange({ ...step, message_group_id: value ?? "" })
                    : setImportGroup(value)
                }
              >
                <SelectTrigger id={`${id}-group`} className="w-full min-w-0">
                  <SelectValue placeholder="选择消息分组" />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={!groups.find((group) => group.id === option.value)?.messageCount}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={query.isFetching || isImporting}
                aria-label="刷新消息分组"
                onClick={() => void query.refetch()}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
            {query.isError ? <FieldError>{query.error.message}</FieldError> : null}
            {!query.isPending && !query.isError && groups.length === 0 ? (
              <FieldDescription>消息库暂无分组，请先在“消息库”页面创建。</FieldDescription>
            ) : null}
            {isLive &&
            selectedId &&
            query.data &&
            !groups.find((group) => group.id === selectedId)?.messageCount ? (
              <FieldError>所选分组不存在或没有消息，请更换分组。</FieldError>
            ) : null}
            {!isLive ? (
              <Button
                type="button"
                variant="outline"
                disabled={
                  !importGroup ||
                  isImporting ||
                  !groups.find((group) => group.id === importGroup)?.messageCount
                }
                onClick={() => void importSnapshot()}
              >
                {isImporting ? <Spinner /> : <DownloadIcon className="size-4" />}
                导入并追加到手动列表
              </Button>
            ) : null}
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          {!isLive ? (
            <MessageListEditor
              value={messages}
              disabled={isImporting}
              onChange={(value) => onChange({ ...step, messages: value })}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            每次执行此步骤随机发送一条，允许与上一次重复；支持在候选消息中引用已提取的变量。
          </p>
        </>
      )}
    </FieldGroup>
  );
}
