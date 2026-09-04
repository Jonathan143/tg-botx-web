import { describe, expect, it } from "vitest";

import {
  createDefaultConditionStep,
  ensureWorkflowNodeIds,
  getNestedCondition,
  inferWorkflowVariables,
  normalizeConditionStep,
  updateNestedCondition,
  validateConditionStep,
  type WorkflowStep,
} from "./workflow-condition";

describe("workflow condition helpers", () => {
  it("创建带默认 if/else 的可视化条件节点", () => {
    const condition = createDefaultConditionStep();

    expect(condition).toMatchObject({
      type: "condition",
      schema_version: 2,
      strict: false,
      extracts: [
        {
          name: "value",
          source: "message_text",
          mode: "whole_text",
          value_type: "text",
        },
      ],
      branches: [
        {
          kind: "if",
          logic: "and",
          conditions: [{ variable: "value", operator: "not_empty", operands: [] }],
        },
        { kind: "else", steps: [] },
      ],
    });
    expect(condition.node_id).toMatch(/^condition-/);
    expect(validateConditionStep(condition)).toEqual([]);
    expect(validateConditionStep(condition, 1, [], false)).toContainEqual({
      path: "extracts",
      message: "提取消息变量前，所有到达路径都必须先有成功的等待消息节点。",
    });
  });

  it("将旧版 condition 配置归一化为 v2 供可视化编辑", () => {
    const condition = normalizeConditionStep({
      type: "condition",
      nodeId: "legacy-condition",
      extract: { name: "balance", mode: "first_number" },
      branches: [
        {
          kind: "if",
          when: { source: "variable", name: "balance", operator: "gt", value: 1000 },
          steps: [{ type: "send_message", text: "余额充足" }],
        },
        { kind: "else", steps: [] },
      ],
    });

    expect(condition.node_id).toBe("legacy-condition");
    expect(condition.schema_version).toBe(2);
    expect(condition.extracts[0]).toMatchObject({
      name: "balance",
      mode: "first_number",
      value_type: "number",
    });
    expect(condition.branches[0].conditions?.[0]).toMatchObject({
      variable: "balance",
      value_type: "number",
      operator: "gt",
      operands: [{ source: "literal", value: "1000" }],
    });
    expect(condition.branches[0].steps[0].node_id).toBeTruthy();
  });

  it("递归补齐节点 ID 且可以按路径更新嵌套条件", () => {
    const nested = createDefaultConditionStep();
    const root = createDefaultConditionStep();
    root.branches[0].steps = [nested];
    const workflow = ensureWorkflowNodeIds([
      { type: "wait_message", timeout_seconds: 60 },
      root,
    ] as WorkflowStep[]);
    const condition = workflow[1];
    expect(workflow[0].node_id).toBeTruthy();
    expect(condition.node_id).toBe(root.node_id);

    const normalized = normalizeConditionStep(condition);
    const path = [{ branchIndex: 0, stepIndex: 0 }];
    const current = getNestedCondition(normalized, path);
    const updated = updateNestedCondition(normalized, path, { ...current, strict: true });

    expect(getNestedCondition(updated, path).strict).toBe(true);
    expect(updated.strict).toBe(false);
  });

  it("校验分支、条件和正则上限", () => {
    const condition = createDefaultConditionStep();
    condition.branches[0].conditions = Array.from({ length: 11 }, () => ({
      variable: "value",
      value_type: "text" as const,
      operator: "regex",
      operands: [{ source: "literal" as const, value: "x".repeat(501) }],
    }));

    const messages = validateConditionStep(condition).map((issue) => issue.message);
    expect(messages).toContain("每个判断分支必须有 1–10 条条件。");
    expect(messages).toContain("正则表达式最多 500 个字符。");
  });

  it("按 Python/JavaScript 标识符规范校验用户自定义提取变量名", () => {
    const condition = createDefaultConditionStep();
    condition.extracts[0].name = "class";

    expect(validateConditionStep(condition).map((issue) => issue.message)).toContain(
      "变量名不能使用 Python/JavaScript 保留关键字。",
    );

    condition.extracts[0].name = "account_id";
    const conditionRule = condition.branches[0].conditions?.[0];
    if (!conditionRule) throw new Error("默认条件规则缺失");
    conditionRule.variable = "account_id";
    expect(validateConditionStep(condition)).toEqual([]);
  });

  it("只把所有互斥分支都定义的同类型变量带到后续路径", () => {
    const condition = createDefaultConditionStep();
    for (const [index, branch] of condition.branches.entries()) {
      const nested = createDefaultConditionStep();
      nested.extracts[0] = {
        name: "shared",
        source: "message_text",
        mode: "whole_text",
        value_type: "text",
      };
      branch.steps = [nested];
      if (index === 0) {
        const exclusive = createDefaultConditionStep();
        exclusive.extracts[0].name = "only_if";
        branch.steps.push(exclusive);
      }
    }

    expect(inferWorkflowVariables([condition])).toEqual([
      { name: "value", valueType: "text" },
      { name: "shared", valueType: "text" },
    ]);
  });
});
