import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import type { Account } from "@/lib/api/types";

type LogoutImpact = {
  enabledTaskCount: number;
  tasks: Array<{ id: string; name: string; enabled: boolean }>;
};

export function LogoutAccountDialog({
  account,
  onComplete,
}: {
  account: Account;
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<LogoutImpact | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);
  useEffect(() => {
    if (open)
      apiRequest<LogoutImpact>(`/api/accounts/${account.id}/logout-impact`)
        .then(setImpact)
        .catch((error) =>
          toast.add({ type: "error", title: "无法检查关联任务", description: error.message }),
        );
  }, [account.id, open]);
  const handleLogout = async () => {
    setIsPending(true);
    try {
      await apiRequest(`/api/accounts/${account.id}/logout`, {
        method: "POST",
        body: jsonBody({}),
      });
      toast.add({ type: "success", title: "Telegram 账号已退出" });
      setOpen(false);
      onComplete();
    } catch (error) {
      toast.add({
        type: "error",
        title: "退出失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    } finally {
      setIsPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>退出账号</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>退出 {account.name}？</DialogTitle>
          <DialogDescription>这会注销 Telegram session 并将账号标记为未激活。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <p className="text-sm text-muted-foreground">
            关联任务 {impact?.tasks.length ?? "…"} 个，其中启用任务{" "}
            {impact?.enabledTaskCount ?? "…"} 个。存在启用任务时后端会拒绝退出。
          </p>
          <Field data-invalid={Boolean(confirmation && confirmation !== account.name)}>
            <FieldLabel htmlFor={`confirm-${account.id}`}>输入账号名称以确认</FieldLabel>
            <Input
              id={`confirm-${account.id}`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <FieldDescription>请输入：{account.name}</FieldDescription>
            {confirmation && confirmation !== account.name ? (
              <FieldError>账号名称不匹配。</FieldError>
            ) : null}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={
              confirmation !== account.name || Boolean(impact?.enabledTaskCount) || isPending
            }
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}确认退出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
