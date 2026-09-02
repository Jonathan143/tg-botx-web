import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { BotCommand } from "@/lib/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";

type CommandCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandCreateDialog({ open, onOpenChange }: CommandCreateDialogProps) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<BotCommand>("/api/bot/commands", {
        method: "POST",
        body: jsonBody({
          command: command.trim(),
          description: description.trim(),
          enabled: false,
          allowedRoles: [],
          executorType: "none",
          executorConfig: {},
        }),
      }),
    onSuccess: () => {
      setCommand("");
      setDescription("");
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

