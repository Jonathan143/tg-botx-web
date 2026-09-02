import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand } from "@/lib/api/types";
import { toast } from "@/components/ui/toast";
import { ROLE_OPTIONS, type CommandRole } from "./command-config-types";

type CommandCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandCreateDialog({ open, onOpenChange }: CommandCreateDialogProps) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<CommandRole[]>(
    ROLE_OPTIONS.map((option) => option.value),
  );
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommand>("/api/bot/commands", {
        method: "POST",
        body: jsonBody({
          command: command.trim(),
          description: description.trim(),
          enabled,
          allowedRoles,
          executorType: "none",
          executorConfig: {},
        }),
      }),
    onSuccess: () => {
      setCommand("");
      setDescription("");
      setEnabled(false);
      setAllowedRoles(ROLE_OPTIONS.map((option) => option.value));
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["bot-commands"] });
      toast.add({ type: "success", title: "自定义指令已新增" });
    },
    onError: (error) =>
      toast.add({ type: "error", title: "新增指令失败", description: error.message }),
  });

  const close = (nextOpen: boolean) => {
    if (mutation.isPending) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新增自定义指令</DialogTitle>
          <DialogDescription>
            新指令默认停用，执行器暂设为 none。保存后可在列表中配置权限和菜单状态。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="new-command">指令名称</Label>
            <Input
              id="new-command"
              maxLength={32}
              placeholder="例如：report"
              value={command}
              onChange={(event) => setCommand(event.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">仅支持小写字母、数字和下划线，最多 32 个字符。</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-command-description">指令说明</Label>
            <Input
              id="new-command-description"
              maxLength={256}
              placeholder="例如：生成日报"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="new-command-enabled">启用开关</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                启用后指令会进入 Telegram 菜单并允许调用。
              </p>
            </div>
            <Switch
              id="new-command-enabled"
              aria-label="菜单可见 / 启用开关"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <div className="grid gap-3 rounded-lg border p-3">
            <div>
              <Label>可调用身份</Label>
              <p className="mt-1 text-xs text-muted-foreground">选择允许直接调用该指令的身份。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map((option) => (
                <label className="flex items-center gap-2 text-sm" key={option.value}>
                  <Checkbox
                    aria-label={`${option.label}可调用`}
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
            disabled={mutation.isPending || !command.trim() || !description.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "保存中…" : "确认新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
