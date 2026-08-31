import { BotIcon } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/components/auth-provider";
import { Spinner } from "@/components/ui/spinner";
import { UnlockForm } from "./components/unlock-form";

export default function UnlockPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destination = (location.state as { from?: string } | null)?.from ?? "/";

  if (auth.status === "authenticated") {
    return <Navigate to={destination} replace />;
  }
  if (auth.status === "loading") {
    return (
      <main className="flex min-h-svh items-center justify-center" aria-label="正在检查会话">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/40 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_32%)] opacity-10" />
      <div className="relative flex w-full max-w-5xl flex-col items-center gap-8 lg:flex-row lg:justify-between">
        <section className="hidden max-w-md flex-col gap-5 lg:flex">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BotIcon />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-4xl font-semibold tracking-tight">
              TG Botx 管理控制台
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              集中查看调度健康状态、管理签到任务、追踪执行记录，并安全维护 Telegram 账号。
            </p>
          </div>
        </section>
        <UnlockForm onSuccess={() => navigate(destination, { replace: true })} />
      </div>
    </main>
  );
}
