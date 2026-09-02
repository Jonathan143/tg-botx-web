import { ArrowDownToLineIcon, ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand, BotCommandsResponse } from "@/lib/api/types";
import { CommandConfigTable } from "./command-config-table";
import { CommandConfigToolbar } from "./command-config-toolbar";
import { CommandCreateDialog } from "./command-create-dialog";
import { type CommandDraft, toCommandDraft } from "./command-config-types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function CommandConfigPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bot-commands"],
    queryFn: () => apiRequest<BotCommandsResponse>("/api/bot/commands"),
  });
  const [drafts, setDrafts] = useState<Record<string, CommandDraft>>({});
  const [search, setSearch] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [group, setGroup] = useState<"all" | "system" | "custom">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setDrafts(Object.fromEntries(query.data.commands.map((item) => [item.command, toCommandDraft(item)])));
  }, [query.data]);

  const updateMutation = useMutation({
    mutationFn: ({ command, draft }: { command: string; draft: CommandDraft }) =>
      apiRequest<BotCommand>(`/api/bot/commands/${command}`, { method: "PATCH", body: jsonBody(draft) }),
    onSuccess: (item) => {
      queryClient.setQueryData<BotCommandsResponse>(["bot-commands"], (current) =>
        current ? { commands: current.commands.map((entry) => (entry.command === item.command ? item : entry)) } : current,
      );
      toast.add({ type: "success", title: `/${item.command} 配置已保存` });
    },
    onError: (error) => toast.add({ type: "error", title: "指令配置保存失败", description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (command: string) => apiRequest(`/api/bot/commands/${command}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-commands"] });
      toast.add({ type: "success", title: "指令已删除", description: "请同步指令以应用菜单变更。" });
    },
    onError: (error) => toast.add({ type: "error", title: "删除指令失败", description: error.message }),
  });

  const filteredCommands = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (query.data?.commands ?? []).filter((item) => {
      const matchesKeyword = !keyword || item.command.includes(keyword) || item.description.toLowerCase().includes(keyword);
      return matchesKeyword && (!onlyEnabled || item.enabled) && (group === "all" || item.type === group);
    });
  }, [group, onlyEnabled, query.data?.commands, search]);
  const pageCount = Math.max(1, Math.ceil(filteredCommands.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleCommands = filteredCommands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (query.isPending && !query.data) return <PageSkeleton />;
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">指令配置</CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              控制 Telegram 菜单中展示的指令、说明及可调用身份。保存后仅更新数据库配置，请通过“同步指令”应用菜单变更；权限变更会立即生效。
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
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
        <div className="overflow-hidden rounded-b-xl border-t">
          <CommandConfigTable
            commands={visibleCommands}
            drafts={drafts}
            onDelete={(command) => deleteMutation.mutateAsync(command).then(() => undefined)}
            onDraftChange={(command, draft) => setDrafts((current) => ({ ...current, [command]: draft }))}
            onSave={(command, draft) => updateMutation.mutate({ command, draft })}
            savingCommand={updateMutation.isPending ? updateMutation.variables?.command ?? null : null}
          />
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>共 {filteredCommands.length} 条</span>
            <div className="flex items-center gap-3">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger aria-label="每页条数" className="h-7 min-w-20" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>)}</SelectContent>
              </Select>
              <Button aria-label="上一页" disabled={currentPage <= 1} size="icon-sm" variant="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeftIcon /></Button>
              <span className="min-w-12 text-center">{currentPage} / {pageCount}</span>
              <Button aria-label="下一页" disabled={currentPage >= pageCount} size="icon-sm" variant="ghost" onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRightIcon /></Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CommandCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Card>
  );
}

function SyncCommandsButton() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => apiRequest<BotCommandsResponse>("/api/bot/commands/sync", { method: "POST", body: jsonBody({}) }),
    onSuccess: (result) => {
      queryClient.setQueryData(["bot-commands"], result);
      toast.add({ type: "success", title: "指令已同步到 Telegram" });
    },
    onError: (error) => toast.add({ type: "error", title: "同步指令失败", description: error.message }),
  });
  return <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}><RefreshCwIcon data-icon="inline-start" />同步指令</Button>;
}
