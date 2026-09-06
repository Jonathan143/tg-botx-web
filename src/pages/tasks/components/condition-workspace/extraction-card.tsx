import { Info, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONDITION_LIMITS,
  CONDITION_METADATA_FIELDS,
  type ConditionExtract,
  createDefaultRegexConfig,
  validateRegexPattern,
  validateWorkflowVariableName,
  type WorkflowValueType,
} from "@/lib/workflow-condition";

import { EXTRACT_MODES, updateExtractMode, VALUE_TYPES } from "./types";
import { cn } from "@/lib/utils";

export function FieldLabelWithHint({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode;
  hint: string;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${String(children)}说明`}
            >
              <Info aria-hidden="true" className="size-3.5" />
            </button>
          }
        />
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ExtractionCard({
  extract,
  index,
  readOnly,
  onChange,
  onDelete,
}: {
  extract: ConditionExtract;
  index: number;
  readOnly: boolean;
  onChange: (next: ConditionExtract) => void;
  onDelete: () => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>变量 {index + 1}</CardTitle>
        <CardDescription>从最近一次成功等待到的消息中提取。</CardDescription>
      </CardHeader>
      <CardContent>
        <ExtractionFields extract={extract} index={index} readOnly={readOnly} onChange={onChange}>
          {!readOnly ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 data-icon="inline-start" />
                删除变量
              </Button>
            </div>
          ) : null}
        </ExtractionFields>
      </CardContent>
    </Card>
  );
}

/**
 * Shared extraction controls used by condition nodes and standalone
 * extract-variable nodes. Keeping the controls in one place prevents the
 * two workflow paths from drifting apart as extraction options evolve.
 */
export function ExtractionFields({
  extract,
  index,
  readOnly,
  onChange,
  showName = true,
  showValueType = true,
  children,
}: {
  extract: ConditionExtract;
  index: number;
  readOnly: boolean;
  onChange: (next: ConditionExtract) => void;
  showName?: boolean;
  showValueType?: boolean;
  children?: ReactNode;
}) {
  const regex = extract.regex ?? createDefaultRegexConfig();
  const nameError = showName ? validateWorkflowVariableName(extract.name) : null;
  const patternError =
    extract.mode === "regex_capture" ? validateRegexPattern(extract.pattern ?? "", regex) : null;
  return (
    <FieldGroup>
      <div className={cn("grid gap-3", showName && showName && "lg:grid-cols-3")}>
        {showName ? (
          <Field>
            <FieldLabelWithHint
              htmlFor={`extract-name-${index}`}
              hint="支持 snake_case 或 camelCase；以字母或下划线开头，最多 64 个字符，不能使用保留关键字。"
            >
              变量名
            </FieldLabelWithHint>
            <Input
              id={`extract-name-${index}`}
              value={extract.name}
              disabled={readOnly}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? `extract-name-error-${index}` : undefined}
              onChange={(event) => onChange({ ...extract, name: event.target.value })}
              placeholder="例如：balance 或 account_id"
            />
            {nameError ? (
              <FieldError id={`extract-name-error-${index}`}>{nameError}</FieldError>
            ) : null}
          </Field>
        ) : null}
        <Field>
          <FieldLabel>提取方式</FieldLabel>
          <Select
            items={EXTRACT_MODES}
            value={extract.mode}
            disabled={readOnly}
            onValueChange={(value) =>
              value && onChange(updateExtractMode(extract, value as ConditionExtract["mode"]))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {EXTRACT_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {showValueType ? (
          <Field>
            <FieldLabel>变量类型</FieldLabel>
            <Select
              items={VALUE_TYPES}
              value={extract.value_type}
              disabled={readOnly || extract.mode === "first_number" || extract.mode === "metadata"}
              onValueChange={(value) =>
                value && onChange({ ...extract, value_type: value as WorkflowValueType })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {VALUE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>
      {extract.mode === "metadata" ? (
        <Field>
          <FieldLabel>元数据字段</FieldLabel>
          <Select
            items={CONDITION_METADATA_FIELDS}
            value={extract.field}
            disabled={readOnly}
            onValueChange={(value) => {
              const selected = CONDITION_METADATA_FIELDS.find((item) => item.value === value);
              if (selected) {
                onChange({ ...extract, field: selected.value, value_type: selected.valueType });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择元数据" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CONDITION_METADATA_FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {extract.mode === "regex_capture" ? (
        <FieldGroup>
          <Field>
            <FieldLabelWithHint
              htmlFor={`extract-pattern-${index}`}
              hint="默认搜索子串，最多 500 字符；输入会即时检查正则语法，运行时单次最多 50ms、单节点总预算 200ms。"
            >
              正则表达式
            </FieldLabelWithHint>
            <Textarea
              id={`extract-pattern-${index}`}
              className="font-mono text-xs"
              value={extract.pattern ?? ""}
              disabled={readOnly}
              maxLength={CONDITION_LIMITS.regexLength}
              aria-invalid={Boolean(patternError)}
              aria-describedby={patternError ? `extract-pattern-error-${index}` : undefined}
              onChange={(event) => onChange({ ...extract, pattern: event.target.value })}
              placeholder="例如：余额：([\d,]+)"
            />
            {patternError ? (
              <FieldError id={`extract-pattern-error-${index}`}>{patternError}</FieldError>
            ) : null}
          </Field>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`extract-group-${index}`}>捕获组</FieldLabel>
              <Input
                id={`extract-group-${index}`}
                value={String(extract.capture_group ?? 1)}
                disabled={readOnly}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange({
                    ...extract,
                    capture_group: /^\d+$/.test(value) ? Number(value) : value,
                  });
                }}
                placeholder="编号 1 或命名组名称"
              />
            </Field>
            <Field>
              <FieldLabel>匹配范围</FieldLabel>
              <ToggleGroup
                value={[regex.match_mode]}
                disabled={readOnly}
                onValueChange={(values) =>
                  values[0] &&
                  onChange({
                    ...extract,
                    regex: { ...regex, match_mode: values[0] as "search" | "full" },
                  })
                }
              >
                <ToggleGroupItem value="search">子串搜索</ToggleGroupItem>
                <ToggleGroupItem value="full">全量匹配</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>
          <div className="flex flex-wrap gap-5">
            <Field orientation="horizontal" className="w-[unset]">
              <FieldLabel htmlFor={`extract-ignore-case-${index}`}>忽略大小写（i）</FieldLabel>
              <Switch
                id={`extract-ignore-case-${index}`}
                checked={regex.ignore_case}
                disabled={readOnly}
                onCheckedChange={(checked) =>
                  onChange({ ...extract, regex: { ...regex, ignore_case: checked } })
                }
              />
            </Field>
            <Field orientation="horizontal" className="w-[unset]">
              <FieldLabel htmlFor={`extract-multiline-${index}`}>多行（m）</FieldLabel>
              <Switch
                id={`extract-multiline-${index}`}
                checked={regex.multiline}
                disabled={readOnly}
                onCheckedChange={(checked) =>
                  onChange({ ...extract, regex: { ...regex, multiline: checked } })
                }
              />
            </Field>
          </div>
        </FieldGroup>
      ) : null}
      {children}
    </FieldGroup>
  );
}
