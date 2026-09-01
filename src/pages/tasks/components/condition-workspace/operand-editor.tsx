import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConditionOperand, WorkflowValueType } from "@/lib/workflow-condition";

import { OPERAND_SOURCE_OPTIONS } from "./types";

export function OperandEditor({
  operand,
  index,
  valueType,
  variables,
  multiple,
  readOnly,
  onChange,
  onDelete,
}: {
  operand: ConditionOperand;
  index: number;
  valueType: WorkflowValueType;
  variables: Array<{ name: string; valueType: WorkflowValueType }>;
  multiple: boolean;
  readOnly: boolean;
  onChange: (operand: ConditionOperand) => void;
  onDelete: () => void;
}) {
  const compatibleVariables = variables.filter((item) => item.valueType === valueType);
  const compatibleVariableItems = compatibleVariables.map((variable) => ({
    value: variable.name,
    label: variable.name,
  }));
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <Select
        items={OPERAND_SOURCE_OPTIONS}
        value={operand.source}
        disabled={readOnly}
        onValueChange={(value) =>
          onChange(
            value === "variable"
              ? { source: "variable", name: compatibleVariables[0]?.name ?? "" }
              : { source: "literal", value: "" },
          )
        }
      >
        <SelectTrigger className="w-full" aria-label={`比较值 ${index + 1} 来源`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {OPERAND_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {operand.source === "variable" ? (
        <Select
          items={compatibleVariableItems}
          value={operand.name}
          disabled={readOnly}
          onValueChange={(value) => value && onChange({ source: "variable", name: value })}
        >
          <SelectTrigger className="w-full" aria-label={`比较变量 ${index + 1}`}>
            <SelectValue placeholder="选择变量" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {compatibleVariables.map((variable) => (
                <SelectItem key={variable.name} value={variable.name}>
                  {variable.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Input
          aria-label={`比较值 ${index + 1}`}
          value={operand.value}
          disabled={readOnly}
          onChange={(event) => onChange({ source: "literal", value: event.target.value })}
          placeholder={
            valueType === "number"
              ? "支持 -1,234.50 或 1 234.50"
              : valueType === "datetime"
                ? "例如：2026-08-31 10:30:00"
                : "输入比较文本"
          }
        />
      )}
      {multiple && !readOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label="删除比较值"
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}
