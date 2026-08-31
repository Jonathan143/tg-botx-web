import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand, BotCommandsResponse } from "@/lib/api/types";

type Draft = Pick<BotCommand, "description" | "enabled">;

export function CommandConfigPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["bot-commands"],
    queryFn: () => apiRequest<BotCommandsResponse>("/api/bot/commands"),
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    if (!query.data) return;
    setDrafts(
      Object.fromEntries(
        query.data.commands.map((item) => [
          item.command,
          { description: item.description, enabled: item.enabled },
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
      toast.add({
        type: item.syncWarning ? "warning" : "success",
        title: item.syncWarning ? "配置已保存，但菜单同步失败" : `/${item.command} 配置已保存`,
        description: item.syncWarning,
      });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "指令配置保存失败", description: error.message }),
  });

  if (query.isPending && !query.data) return <PageSkeleton />;
  if (query.isError && !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const commands = query.data?.commands ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>指令配置</CardTitle>
        <CardDescription>
          控制 Telegram 菜单中展示的指令及其说明。停用后，指令不会出现在菜单中，也无法执行。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {commands.map((item) => {
            const draft = drafts[item.command] ?? {
              description: item.description,
              enabled: item.enabled,
            };
            const changed =
              draft.description !== item.description || draft.enabled !== item.enabled;
            return (
              <div
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                key={item.command}
              >
                <div className="flex min-w-28 items-center gap-2">
                  <code className="text-sm font-semibold">/{item.command}</code>
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
                <Button
                  disabled={!changed || mutation.isPending || !draft.description.trim()}
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
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
