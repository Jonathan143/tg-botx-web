// biome-ignore-all lint/suspicious/noArrayIndexKey: Extraction rows use stable positional editing to preserve input focus.
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  CONDITION_LIMITS,
  type ConditionStep,
  createDefaultExtract,
} from "@/lib/workflow-condition";

import { ExtractionCard } from "./extraction-card";

export function GlobalConfig({
  condition,
  readOnly,
  onChange,
}: {
  condition: ConditionStep;
  readOnly: boolean;
  onChange: (condition: ConditionStep) => void;
}) {
  return (
    <>
      <FieldSet>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <FieldLegend>变量提取</FieldLegend>
            <FieldDescription>
              变量贯穿本次工作流运行，后续消息、等待匹配和按钮定位可用 {"{{ variable }}"} 引用。
            </FieldDescription>
          </div>
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={condition.extracts.length >= CONDITION_LIMITS.extracts}
              onClick={() =>
                onChange({
                  ...condition,
                  extracts: [
                    ...condition.extracts,
                    createDefaultExtract(condition.extracts.length),
                  ],
                })
              }
            >
              <Plus data-icon="inline-start" />
              添加变量
            </Button>
          ) : null}
        </div>
        {condition.extracts.length === 0 ? (
          <Card size="sm">
            <CardContent className="text-sm text-muted-foreground">
              尚未在此节点提取变量；仍可引用前序路径上已存在的变量。
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {condition.extracts.map((extract, index) => (
              <ExtractionCard
                key={`extract-${index}`}
                extract={extract}
                index={index}
                readOnly={readOnly}
                onChange={(next) =>
                  onChange({
                    ...condition,
                    extracts: condition.extracts.map((item, itemIndex) =>
                      itemIndex === index ? next : item,
                    ),
                  })
                }
                onDelete={() =>
                  onChange({
                    ...condition,
                    extracts: condition.extracts.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              />
            ))}
          </div>
        )}
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>节点行为</FieldLegend>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="condition-strict">严格模式</FieldLabel>
            <FieldDescription>
              关闭时，提取失败、变量不存在或类型不符按 false 进入后续分支；开启时直接使任务失败。
            </FieldDescription>
          </FieldContent>
          <Switch
            id="condition-strict"
            checked={condition.strict}
            disabled={readOnly}
            onCheckedChange={(strict) => onChange({ ...condition, strict })}
          />
        </Field>
      </FieldSet>
    </>
  );
}
