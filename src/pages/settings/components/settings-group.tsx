import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const labelMap: Record<string, string> = {
  host: "监听地址",
  port: "监听端口",
  origin: "后台来源",
  database: "数据库类型",
  databaseUrl: "数据库连接",
  timezone: "默认时区",
  sessionDays: "会话有效期（天）",
  transportKeyRotationHours: "传输密钥轮换（小时）",
  logLevel: "日志级别",
  logPath: "日志路径",
};

export function SettingsGroup({
  title,
  description,
  values,
}: {
  title: string;
  description: string;
  values: Record<string, string | number | boolean | null>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          {Object.entries(values).map(([key, value], index) => (
            <div key={key} className="flex flex-col gap-3">
              {index ? <Separator /> : null}
              <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
                <dt className="text-sm text-muted-foreground">{labelMap[key] ?? key}</dt>
                <dd className="break-all font-mono text-sm">
                  {value === null
                    ? "未配置"
                    : typeof value === "boolean"
                      ? value
                        ? "是"
                        : "否"
                      : String(value)}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
