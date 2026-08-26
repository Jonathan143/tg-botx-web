import { QrCodeIcon, SmartphoneIcon } from "lucide-react";
import QRCode from "qrcode";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { submitEncryptedValue } from "@/lib/api/crypto";
import type { LoginFlow } from "@/lib/api/types";

export function LoginAccountDialog({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"qr" | "phone">("qr");
  const [accountName, setAccountName] = useState("default");
  const [flow, setFlow] = useState<LoginFlow | null>(null);
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const isPhoneInputStage =
    flow?.stage === "phone_required" ||
    flow?.stage === "code_pending" ||
    flow?.stage === "password_pending";

  useEffect(() => {
    if (!flow?.qrUrl) {
      setQrImage(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(flow.qrUrl, { width: 512, margin: 2 })
      .then((image) => {
        if (active) setQrImage(image);
      })
      .catch(() => setError("无法生成登录二维码。"));
    return () => {
      active = false;
    };
  }, [flow?.qrUrl]);

  useEffect(() => {
    if (!open || !flow || flow.stage === "completed" || flow.stage === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await apiRequest<LoginFlow>(`/api/accounts/login-flows/${flow.flowId}`);
        setFlow(next);
        if (next.stage === "completed") {
          toast.add({ type: "success", title: "Telegram 账号登录成功" });
          onComplete();
          setOpen(false);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [flow, onComplete, open]);

  const startFlow = async () => {
    setError(null);
    setIsPending(true);
    try {
      setFlow(
        await apiRequest<LoginFlow>("/api/accounts/login-flows", {
          method: "POST",
          body: jsonBody({ accountName, method }),
        }),
      );
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "无法创建登录流程。");
    } finally {
      setIsPending(false);
    }
  };

  const submitStep = async () => {
    if (!flow || !value) return;
    const purpose =
      flow.stage === "phone_required"
        ? "phone"
        : flow.stage === "password_pending"
          ? "password"
          : "code";
    setIsPending(true);
    setError(null);
    try {
      const next = await submitEncryptedValue<LoginFlow>(
        `/api/accounts/login-flows/${flow.flowId}/${purpose}`,
        purpose,
        value,
      );
      setValue("");
      setFlow(next);
      if (next.stage === "completed") {
        toast.add({ type: "success", title: "Telegram 账号登录成功" });
        onComplete();
        setOpen(false);
      }
    } catch (stepError) {
      setError(stepError instanceof Error ? stepError.message : "登录步骤失败。");
    } finally {
      setIsPending(false);
    }
  };

  const handleOpenChange = async (nextOpen: boolean) => {
    if (!nextOpen && flow && flow.stage !== "completed") {
      try {
        await apiRequest(`/api/accounts/login-flows/${flow.flowId}`, {
          method: "DELETE",
          body: jsonBody({}),
        });
      } catch {
        /* 服务端过期也会自动清理 */
      }
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      setFlow(null);
      setValue("");
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <SmartphoneIcon data-icon="inline-start" />
        登录 Telegram 账号
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>登录 Telegram 账号</DialogTitle>
          <DialogDescription>
            二维码为推荐方式；敏感输入均使用后端公钥加密后提交。
          </DialogDescription>
        </DialogHeader>
        {!flow ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">账号名称</FieldLabel>
              <Input
                id="account-name"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
              />
            </Field>
            <Tabs value={method} onValueChange={(value) => setMethod(value as "qr" | "phone")}>
              <TabsList>
                <TabsTrigger value="qr">
                  <QrCodeIcon />
                  二维码
                </TabsTrigger>
                <TabsTrigger value="phone">
                  <SmartphoneIcon />
                  手机号
                </TabsTrigger>
              </TabsList>
              <TabsContent value="qr" className="pt-4 text-sm text-muted-foreground">
                在 Telegram 已登录设备中扫描二维码，过期后后台会自动刷新。
              </TabsContent>
              <TabsContent value="phone" className="pt-4 text-sm text-muted-foreground">
                依次输入手机号、验证码；如已开启两步验证，再输入 2FA 密码。
              </TabsContent>
            </Tabs>
          </FieldGroup>
        ) : null}
        {flow?.method === "qr" && qrImage ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-5">
            <img
              src={qrImage}
              alt="Telegram 登录二维码"
              className="size-64 max-w-full rounded-lg"
            />
            <p className="text-center text-sm text-muted-foreground">
              请使用 Telegram 扫描。二维码过期会自动更新。
            </p>
          </div>
        ) : null}
        {flow && flow.method === "phone" && isPhoneInputStage ? (
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="login-value">
              {flow.stage === "phone_required"
                ? "手机号（含国家区号）"
                : flow.stage === "password_pending"
                  ? "2FA 密码"
                  : "Telegram 验证码"}
            </FieldLabel>
            <Input
              id="login-value"
              type={flow.stage === "password_pending" ? "password" : "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(error)}
            />
            <FieldDescription>该值不会写入日志或浏览器存储。</FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        ) : null}
        {error && !flow ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          {!flow ? (
            <Button onClick={startFlow} disabled={!accountName.trim() || isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}开始登录
            </Button>
          ) : flow.method === "phone" && isPhoneInputStage ? (
            <Button onClick={submitStep} disabled={!value || isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}继续
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Spinner data-icon="inline-start" />
              {flow.method === "qr" ? "等待扫码…" : "正在连接…"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
