import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskStepStatus } from "@/lib/api/types";

export function ConditionRunSummary({ status }: { status?: TaskStepStatus }) {
  if (!status) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>本次运行</CardTitle>
        <CardDescription>
          {status.selectedBranch
            ? `命中分支：${status.selectedBranch.name || status.selectedBranch.kind}`
            : "尚未记录命中分支"}
        </CardDescription>
      </CardHeader>
      {status.conditionVariables?.length ? (
        <CardContent className="flex flex-wrap gap-2">
          {status.conditionVariables.map((variable) => (
            <Badge
              key={variable.name}
              variant={variable.status === "failed" ? "destructive" : "outline"}
            >
              {variable.name}
              {variable.value != null
                ? ` = ${variable.value}`
                : variable.error
                  ? ` · ${variable.error}`
                  : ""}
            </Badge>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
