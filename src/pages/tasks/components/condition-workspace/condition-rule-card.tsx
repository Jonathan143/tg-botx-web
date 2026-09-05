// biome-ignore-all lint/suspicious/noArrayIndexKey: Controlled condition rows are reordered transactionally; index keys keep text inputs focused while their values change.
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type ConditionRule,
  createDefaultNormalization,
  createDefaultRegexConfig,
  createDefaultRule,
  operandValueType,
  reconcileRuleOperands,
  validateRegexPattern,
  type WorkflowValueType,
} from "@/lib/workflow-condition";

import { OperandEditor } from "./operand-editor";
import { CONDITION_OPERATORS, VALUE_TYPES } from "./types";

export function ConditionRuleCard({
  rule,
  index,
  variables,
  readOnly,
  onChange,
  onDelete,
}: {
  rule: ConditionRule;
  index: number;
  variables: Array<{ name: string; valueType: WorkflowValueType }>;
  readOnly: boolean;
  onChange: (rule: ConditionRule) => void;
  onDelete: () => void;
}) {
  const operators = CONDITION_OPERATORS[rule.value_type];
  const operator = operators.find((item) => item.value === rule.operator) ?? operators[0];
  const normalization = rule.normalization ?? createDefaultNormalization();
  const regex = rule.regex ?? createDefaultRegexConfig();
  const operandType = operandValueType(rule);
  const regexError =
    rule.operator === "regex" && rule.operands[0]?.source === "literal"
      ? validateRegexPattern(rule.operands[0].value, regex)
      : null;
  const setRule = (next: ConditionRule) => onChange(reconcileRuleOperands(next));
  const variableItems = variables.map((variable) => ({
    value: variable.name,
    label: `${variable.name} · ${
      VALUE_TYPES.find((item) => item.value === variable.valueType)?.label ?? variable.valueType
    }`,
  }));
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>条件 {index + 1}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field>
              <FieldLabel>引用变量</FieldLabel>
              <Select
                items={variableItems}
                value={rule.variable}
                disabled={readOnly}
                onValueChange={(value) => {
                  const variable = variables.find((item) => item.name === value);
                  if (!variable) return;
                  setRule(createDefaultRule(variable.name, variable.valueType));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="先在上方提取变量" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {variables.map((variable) => (
                      <SelectItem key={variable.name} value={variable.name}>
                        {variable.name} ·{" "}
                        {VALUE_TYPES.find((item) => item.value === variable.valueType)?.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>判断方式</FieldLabel>
              <Select
                items={operators}
                value={rule.operator}
                disabled={readOnly}
                onValueChange={(value) => value && setRule({ ...rule, operator: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {operators.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {operator.operands !== 0 ? (
            <Field>
              <FieldLabel>{operator.operands === 2 ? "区间边界" : "比较值"}</FieldLabel>
              <div className="flex flex-col gap-2">
                {rule.operands.map((operand, operandIndex) => (
                  <OperandEditor
                    key={`operand-${operandIndex}`}
                    operand={operand}
                    index={operandIndex}
                    valueType={operandType}
                    variables={variables}
                    multiple={operator.operands === "many" && rule.operands.length > 1}
                    readOnly={readOnly}
                    error={operandIndex === 0 ? (regexError ?? undefined) : undefined}
                    errorId={operandIndex === 0 ? `rule-${index}-regex-error` : undefined}
                    onChange={(next) =>
                      onChange({
                        ...rule,
                        operands: rule.operands.map((item, itemIndex) =>
                          itemIndex === operandIndex ? next : item,
                        ),
                      })
                    }
                    onDelete={() =>
                      onChange({
                        ...rule,
                        operands: rule.operands.filter(
                          (_, itemIndex) => itemIndex !== operandIndex,
                        ),
                      })
                    }
                  />
                ))}
                {operator.operands === "many" && !readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...rule,
                        operands: [...rule.operands, { source: "literal", value: "" }],
                      })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    添加集合值
                  </Button>
                ) : null}
              </div>
            </Field>
          ) : null}
          {rule.value_type === "text" ? (
            <FieldSet>
              <FieldLegend variant="label">字符归一化</FieldLegend>
              <div className="flex flex-wrap gap-8">
                {(
                  [
                    ["trim", "去除首尾空白"],
                    ["ignore_case", "忽略大小写"],
                    ["collapse_whitespace", "压缩连续空白"],
                    ["strip_markdown", "去除 Markdown"],
                  ] as const
                ).map(([field, label]) => (
                  <Field orientation="horizontal" key={field} className="w-[unset] cursor-pointer">
                    <FieldLabel htmlFor={`rule-${index}-${field}`} className="cursor-pointer">
                      {label}
                    </FieldLabel>
                    <Switch
                      id={`rule-${index}-${field}`}
                      size="sm"
                      checked={normalization[field]}
                      disabled={readOnly}
                      onCheckedChange={(checked) =>
                        onChange({ ...rule, normalization: { ...normalization, [field]: checked } })
                      }
                    />
                  </Field>
                ))}
              </div>
            </FieldSet>
          ) : null}
          {rule.operator === "regex" ? (
            <FieldSet>
              <FieldLegend variant="label">正则执行</FieldLegend>
              <div className="flex flex-wrap items-center gap-5">
                <ToggleGroup
                  value={[regex.match_mode]}
                  disabled={readOnly}
                  onValueChange={(values) =>
                    values[0] &&
                    onChange({
                      ...rule,
                      regex: { ...regex, match_mode: values[0] as "search" | "full" },
                    })
                  }
                >
                  <ToggleGroupItem value="search">子串搜索</ToggleGroupItem>
                  <ToggleGroupItem value="full">全量匹配</ToggleGroupItem>
                </ToggleGroup>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`rule-${index}-regex-i`}>忽略大小写（i）</FieldLabel>
                  <Switch
                    id={`rule-${index}-regex-i`}
                    size="sm"
                    checked={regex.ignore_case}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...rule, regex: { ...regex, ignore_case: checked } })
                    }
                  />
                </Field>
                <Field orientation="horizontal" className="w-[unset]">
                  <FieldLabel htmlFor={`rule-${index}-regex-m`}>多行（m）</FieldLabel>
                  <Switch
                    id={`rule-${index}-regex-m`}
                    size="sm"
                    checked={regex.multiline}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange({ ...rule, regex: { ...regex, multiline: checked } })
                    }
                  />
                </Field>
              </div>
              <FieldDescription>
                正则固定值最多 500 字符，运行时采用安全超时与输入长度限制。
              </FieldDescription>
            </FieldSet>
          ) : null}
          {!readOnly ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 data-icon="inline-start" />
                删除条件
              </Button>
            </div>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
