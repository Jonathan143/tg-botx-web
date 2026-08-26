import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatChartLabel, type DashboardRange } from "@/lib/format";

const chartConfig = {
  success: { label: "成功", color: "var(--chart-2)" },
  failed: { label: "失败", color: "var(--destructive)" },
} satisfies ChartConfig;

export function SuccessChart({
  data,
  range,
}: {
  data: Array<{ label: string; success: number; failed: number }>;
  range: DashboardRange;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>执行趋势</CardTitle>
        <CardDescription>
          当前时间范围内成功与失败的任务执行次数，时间按本地时区显示。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={(value) => formatChartLabel(String(value), range)}
            />
            <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatChartLabel(String(payload[0]?.payload?.label ?? ""), range)
                  }
                />
              }
            />
            <Area
              dataKey="success"
              type="monotone"
              fill="var(--color-success)"
              fillOpacity={0.22}
              stroke="var(--color-success)"
            />
            <Area
              dataKey="failed"
              type="monotone"
              fill="var(--color-failed)"
              fillOpacity={0.1}
              stroke="var(--color-failed)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
