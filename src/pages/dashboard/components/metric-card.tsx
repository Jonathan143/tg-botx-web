import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardDescription>{title}</CardDescription>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
