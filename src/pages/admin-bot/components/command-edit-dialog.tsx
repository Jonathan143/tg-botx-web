import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand } from "@/lib/api/types";
import { toast } from "@/components/ui/toast";
import { ROLE_OPTIONS, type CommandRole } from "./command-config-types";

type Props = {
  command: BotCommand | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (previous: string, next: string) => void;
};

export function CommandEditDialog({ command, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<CommandRole[]>([]);
  useEffect(() => {
    if (!command) return;
    setName(command.command);
    setDescription(command.description);
    setEnabled(command.enabled);
    setMenuVisible(command.menuVisible);
    setAllowedRoles(
      command.allowedRoles.filter((role): role is CommandRole =>
        ROLE_OPTIONS.some((option) => option.value === role),
      ),
    );
  }, [command]);
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommand>(`/api/bot/commands/${command?.command}`, {
        method: "PATCH",
        body: jsonBody({
          command: name.trim(),
          description: description.trim(),
          enabled,
          menuVisible,
          allowedRoles,
        }),
      }),
    onSuccess: (item) => {
      const previous = command?.command ?? item.command;
      queryClient.setQueryData<{ commands: BotCommand[] }>(["bot-commands"], (current) =>
        current
          ? {
              commands: current.commands.map((entry) =>
                entry.command === previous ? item : entry,
              ),
            }
          : current,
      );
      onSaved?.(previous, item.command);
      onOpenChange(false);
      toast.add({ type: "success", title: `/${item.command} 配置已保存` });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "指令配置保存失败", description: error.message }),
  });
  const close = (open: boolean) => {
    if (!mutation.isPending) onOpenChange(open);
  };
  if (!command) return null;
  return (
    <Dialog open={Boolean(command)} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑指令</DialogTitle>
          <DialogDescription>分别设置指令启用状态和菜单显示状态。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-command">指令名称</Label>
            <Input
              id="edit-command"
              maxLength={32}
              value={name}
              disabled={command.type === "system"}
              onChange={(event) => setName(event.target.value.toLowerCase())}
            />
            {command.type === "system" && (
              <p className="text-xs text-muted-foreground">系统指令名称不可修改。</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-command-description">指令说明</Label>
            <Input
              id="edit-command-description"
              maxLength={256}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="edit-command-enabled">启用状态</Label>
              <p className="mt-1 text-xs text-muted-foreground">控制指令是否允许被调用。</p>
            </div>
            <Switch id="edit-command-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="edit-command-menu-visible">菜单显示</Label>
              <p className="mt-1 text-xs text-muted-foreground">控制是否出现在 Telegram 菜单中。</p>
            </div>
            <Switch
              id="edit-command-menu-visible"
              checked={menuVisible}
              onCheckedChange={setMenuVisible}
            />
          </div>
          <div className="grid gap-3 rounded-lg border p-3">
            <Label>可调用身份</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map((option) => (
                <label className="flex items-center gap-2 text-sm" key={option.value}>
                  <Checkbox
                    checked={allowedRoles.includes(option.value)}
                    onCheckedChange={(checked) =>
                      setAllowedRoles((current) =>
                        checked
                          ? [...new Set([...current, option.value])]
                          : current.filter((role) => role !== option.value),
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={mutation.isPending} variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={mutation.isPending || !name.trim() || !description.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "保存中…" : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
