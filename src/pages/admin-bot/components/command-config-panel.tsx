import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLineIcon, PlusIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand, BotCommandsResponse } from "@/lib/api/types";

type CommandRole = "anonymous" | "user" | "admin";
type Draft = Pick<BotCommand, "description" | "enabled"> & { allowedRoles: CommandRole[] };
const ROLE_OPTIONS: Array<{ value: CommandRole; label: string }> = [
  { value: "anonymous", label: "未绑定用户" },
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

export function CommandConfigPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bot-commands"],
    queryFn: () => apiRequest<BotCommandsResponse>("/api/bot/commands"),
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newCommand, setNewCommand] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    if (!query.data) return;
    setDrafts(
      Object.fromEntries(
        query.data.commands.map((item) => [
          item.command,
          {
            description: item.description,
            enabled: item.enabled,
            allowedRoles: item.allowedRoles.filter((role): role is CommandRole =>
              ROLE_OPTIONS.some((option) => option.value === role),
            ),
          },
        ]),
      ),
    );
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: ({ command, draft }: { command: string; draft: Draft }) =>
      apiRequest<BotCommand>(`/api/bot/commands/${command}`, {
        method: "PATCH",
        body: jsonBody(draft),
      }),
    onSuccess: (item) => {
      queryClient.setQueryData<BotCommandsResponse>(["bot-commands"], (current) =>
        current
          ? {
              commands: current.commands.map((command) =>
                command.command === item.command ? item : command,
              ),
            }
          : current,
      );
      toast.add({ type: "success", title: `/${item.command} 配置已保存` });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "指令配置保存失败", description: error.message }),
  });
  const pullMutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommandsResponse>("/api/bot/commands/pull", {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["bot-commands"], result);
      toast.add({
        type: "success",
        title: "指令已从 Telegram 拉取",
        description: "数据库配置已更新。",
      });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "拉取指令失败", description: error.message }),
  });
  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommandsResponse>("/api/bot/commands/sync", {
        method: "POST",
        body: jsonBody({}),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["bot-commands"], result);
      toast.add({ type: "success", title: "指令已同步到 Telegram" });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "同步指令失败", description: error.message }),
  });
  const deleteMutation = useMutation({
    mutationFn: (command: string) =>
      apiRequest(`/api/bot/commands/${command}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-commands"] });
      toast.add({
        type: "success",
        title: "指令已删除",
        description: "请点击“同步指令”将变更应用到 Telegram。",
      });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "删除指令失败", description: error.message }),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommand>("/api/bot/commands", {
        method: "POST",
        body: jsonBody({
          command: newCommand.trim(),
          description: newDescription.trim(),
          enabled: false,
          allowedRoles: [],
          executorType: "none",
          executorConfig: {},
        }),
      }),
    onSuccess: () => {
      setNewCommand("");
      setNewDescription("");
      queryClient.invalidateQueries({ queryKey: ["bot-commands"] });
      toast.add({ type: "success", title: "自定义指令已新增" });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "新增指令失败", description: error.message }),
  });

  if (query.isPending && !query.data) return <PageSkeleton />;
  if (query.isError && !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const commands = query.data?.commands ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>指令配置</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pullMutation.isPending || syncMutation.isPending}
              onClick={() => pullMutation.mutate()}
            >
              <ArrowDownToLineIcon data-icon="inline-start" />
              拉取指令
            </Button>
            <Button
              size="sm"
              disabled={pullMutation.isPending || syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCwIcon data-icon="inline-start" />
              同步指令
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end">
          <Input
            aria-label="新指令名称"
            maxLength={32}
            placeholder="新指令名称（如 report）"
            value={newCommand}
            onChange={(event) => setNewCommand(event.target.value.toLowerCase())}
          />
          <Input
            aria-label="新指令说明"
            maxLength={256}
            placeholder="指令说明"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <Button
            disabled={createMutation.isPending || !newCommand.trim() || !newDescription.trim()}
            onClick={() => createMutation.mutate()}
          >
            <PlusIcon data-icon="inline-start" />
            新增自定义指令
          </Button>
        </div>
        <CardDescription>
          控制 Telegram 菜单中展示的指令、说明及可调用身份。保存只更新数据库配置，请通过“手动同步指令”
          应用菜单变更到 Telegram；权限变更会立即生效。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {commands.map((item) => {
            const draft = drafts[item.command] ?? {
              description: item.description,
              enabled: item.enabled,
              allowedRoles: item.allowedRoles.filter(
                (role): role is CommandRole =>
                  ROLE_OPTIONS.some((option) => option.value === role),
              ),
            };
            const changed =
              draft.description !== item.description ||
              draft.enabled !== item.enabled ||
              draft.allowedRoles.join(",") !== item.allowedRoles.join(",");
            return (
              <div
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                key={item.command}
              >
                <div className="flex min-w-28 items-center gap-2">
                  <code className="text-sm font-semibold">/{item.command}</code>
                  <Badge variant="outline">{item.type === "system" ? "系统" : "自定义"}</Badge>
                  <Badge variant={draft.enabled ? "default" : "secondary"}>
                    {draft.enabled ? "启用" : "停用"}
                  </Badge>
                </div>
                <Input
                  aria-label={`/${item.command} 指令说明`}
                  className="sm:flex-1"
                  maxLength={256}
                  value={draft.description}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.command]: { ...draft, description: event.target.value },
                    }))
                  }
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    aria-label={`启用 /${item.command}`}
                    checked={draft.enabled}
                    onCheckedChange={(enabled) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.command]: { ...draft, enabled },
                      }))
                    }
                  />
                  菜单可见
                </label>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="text-xs font-medium">可调用身份</span>
                  {ROLE_OPTIONS.map((option) => (
                    <label className="flex items-center gap-1.5" key={option.value}>
                      <Checkbox
                        aria-label={`${option.label}可调用 /${item.command}`}
                        checked={draft.allowedRoles.includes(option.value)}
                        onCheckedChange={(checked) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.command]: {
                              ...draft,
                              allowedRoles: checked
                                ? [...draft.allowedRoles, option.value]
                                : draft.allowedRoles.filter((role) => role !== option.value),
                            },
                          }))
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <Button
                  disabled={
                    !changed ||
                    mutation.isPending ||
                    !draft.description.trim()
                  }
                  size="sm"
                  onClick={() =>
                    mutation.mutate({
                      command: item.command,
                      draft: { ...draft, description: draft.description.trim() },
                    })
                  }
                >
                  <SaveIcon data-icon="inline-start" />
                  保存
                </Button>
                {item.type === "custom" && <ConfirmAction
                  actionLabel="确认删除"
                  description={`删除 /${item.command} 后会移除本地自定义指令配置；如需应用菜单变更，请再同步指令。`}
                  title={`删除 /${item.command} 指令？`}
                  triggerLabel="删除"
                  variant="destructive"
                  onConfirm={async () => {
                    await deleteMutation.mutateAsync(item.command);
                  }}
                />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
