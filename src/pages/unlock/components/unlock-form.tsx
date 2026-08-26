import { KeyRoundIcon, LockKeyholeIcon } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function UnlockForm({ onSuccess }: { onSuccess: () => void }) {
  const { unlock } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const secret = String(form.get("secret") ?? "");
    if (!secret) {
      setError("请输入管理密钥。");
      return;
    }
    setIsSubmitting(true);
    try {
      await unlock(secret);
      event.currentTarget.reset();
      onSuccess();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "密钥校验失败。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KeyRoundIcon />
        </div>
        <CardTitle className="text-xl">解锁管理后台</CardTitle>
        <CardDescription>请输入部署在 tg-bot 环境变量中的管理密钥。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="secret">管理密钥</FieldLabel>
              <Input
                id="secret"
                name="secret"
                type="password"
                autoComplete="current-password"
                autoFocus
                aria-invalid={Boolean(error)}
                disabled={isSubmitting}
              />
              <FieldDescription>
                密钥会先在浏览器中使用后端公钥加密，不会保存到浏览器存储。
              </FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LockKeyholeIcon data-icon="inline-start" />
              )}
              {isSubmitting ? "正在安全校验…" : "解锁后台"}
            </Button>
            <Alert>
              <LockKeyholeIcon />
              <AlertTitle>安全连接</AlertTitle>
              <AlertDescription>生产环境仍必须使用 HTTPS；公钥加密不能替代 TLS。</AlertDescription>
            </Alert>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
