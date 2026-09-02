import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLineIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand, BotCommandsResponse } from "@/lib/api/types";
import { CommandConfigTable } from "./command-config-table";
import { CommandConfigToolbar } from "./command-config-toolbar";
import { CommandCreateDialog } from "./command-create-dialog";
import { CommandEditDialog } from "./command-edit-dialog";

export function CommandConfigPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bot-commands"],
    queryFn: () => apiRequest<BotCommandsResponse>("/api/bot/commands"),
  });
  const [search, setSearch] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [group, setGroup] = useState<"all" | "system" | "custom">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<BotCommand | null>(null);
  const [commandOrder, setCommandOrder] = useState<string[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);

  useEffect(() => {
    if (!query.data || orderDirty) return;
    setCommandOrder(query.data.commands.map((item) => item.command));
  }, [orderDirty, query.data]);

  const orderMutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommandsResponse>("/api/bot/commands/order", {
        method: "PUT",
        body: jsonBody({ commands: commandOrder }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["bot-commands"], result);
      setOrderDirty(false);
      toast.add({ type: "success", title: "指令排序已保存" });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "保存指令排序失败", description: error.message }),
  });

  const handleReorder = (source: string, target: string) => {
    setCommandOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(source);
      const targetIndex = next.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
    setOrderDirty(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (command: string) =>
      apiRequest(`/api/bot/commands/${command}`, { method: "DELETE" }),
    onSuccess: (_data, command) => {
      setOrderDirty(false);
      setCommandOrder((current) => current.filter((item) => item !== command));
      queryClient.invalidateQueries({ queryKey: ["bot-commands"] });
      toast.add({
        type: "success",
        title: "指令已删除",
        description: "请同步指令以应用菜单变更。",
      });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "删除指令失败", description: error.message }),
  });

  const filteredCommands = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const commands = query.data?.commands ?? [];
    const orderIndex = new Map(commandOrder.map((command, index) => [command, index]));
    return [...commands]
      .sort(
        (left, right) =>
          (orderIndex.get(left.command) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right.command) ?? Number.MAX_SAFE_INTEGER),
      )
      .filter((item) => {
        const matchesKeyword =
          !keyword ||
          item.command.includes(keyword) ||
          item.description.toLowerCase().includes(keyword);
        return (
          matchesKeyword &&
          (!onlyEnabled || item.enabled) &&
          (group === "all" || item.type === group)
        );
      });
  }, [commandOrder, group, onlyEnabled, query.data?.commands, search]);
  if (query.isPending && !query.data) return <PageSkeleton />;
  if (query.isError && !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">指令配置 (共{filteredCommands.length} 条)</CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              分别控制指令启用状态、Telegram
              菜单显示和可调用身份。保存后仅更新数据库配置，请通过“同步指令”应用菜单变更；权限变更会立即生效。
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {orderDirty && (
              <Button
                size="sm"
                variant="outline"
                disabled={orderMutation.isPending}
                onClick={() => orderMutation.mutate()}
              >
                保存排序
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
              <ArrowDownToLineIcon data-icon="inline-start" />
              拉取指令
            </Button>
            <SyncCommandsButton />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <CommandConfigToolbar
          group={group}
          onCreate={() => setCreateOpen(true)}
          onGroupChange={setGroup}
          onOnlyEnabledChange={setOnlyEnabled}
          onSearchChange={setSearch}
          onlyEnabled={onlyEnabled}
          search={search}
        />
        <div className="overflow-hidden rounded-b-xl">
          <CommandConfigTable
            commands={filteredCommands}
            onDelete={(command) => deleteMutation.mutateAsync(command).then(() => undefined)}
            onEdit={setEditingCommand}
            onReorder={handleReorder}
            savingCommand={null}
          />
        </div>
      </CardContent>
      <CommandCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CommandEditDialog
        command={editingCommand}
        onOpenChange={(open) => !open && setEditingCommand(null)}
        onSaved={(previous, next) =>
          setCommandOrder((current) => current.map((item) => (item === previous ? next : item)))
        }
      />
    </Card>
  );
}

function SyncCommandsButton() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
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
  return (
    <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      <RefreshCwIcon data-icon="inline-start" />
      同步指令
    </Button>
  );
}
