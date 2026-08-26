import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const healthLabels: Record<string, string> = {
  service: "后台服务",
  database: "数据库",
  scheduler: "调度器",
  telegram: "Telegram",
};

export function HealthPanel({ health }: { health: Record<string, string> }) {
  const entries = ["service", "database", "scheduler", "telegram"].map(
    (name) => [name, health[name] ?? "unknown"] as const,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>服务健康</CardTitle>
        <CardDescription>后端关键依赖的实时状态。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.map(([name, status], index) => (
          <div key={name} className="flex flex-col gap-3">
            {index > 0 ? <Separator /> : null}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{healthLabels[name] ?? name}</span>
              <StatusBadge status={status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
