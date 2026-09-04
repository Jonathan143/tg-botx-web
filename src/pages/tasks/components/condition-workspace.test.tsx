import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultConditionStep, createDefaultRule } from "@/lib/workflow-condition";

import { ConditionWorkspace } from "./condition-workspace";

describe("ConditionWorkspace", () => {
  it("在外层草稿中编辑并应用条件配置", () => {
    const onApply = vi.fn();
    render(
      <ConditionWorkspace
        step={createDefaultConditionStep()}
        open
        onOpenChange={vi.fn()}
        onApply={onApply}
        renderSequence={() => <p>分支子画布</p>}
      />,
    );

    expect(screen.getByRole("heading", { name: "条件判断工作区" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "全局配置" })).toBeTruthy();
    expect(screen.getByText("全文")).toBeTruthy();
    expect(screen.getByText("文本")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /满足条件/ }));
    expect(screen.getByText("分支子画布")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("分支名称"), { target: { value: "余额充足" } });
    fireEvent.click(screen.getByRole("button", { name: "全局配置" }));
    fireEvent.click(screen.getByRole("switch", { name: "严格模式" }));
    fireEvent.click(screen.getByRole("button", { name: "应用条件配置" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({
      strict: true,
      branches: [{ kind: "if", name: "余额充足" }, { kind: "else" }],
    });
  });

  it("将单条配置错误直接放在弹框 footer 左侧", () => {
    render(
      <ConditionWorkspace
        step={createDefaultConditionStep()}
        open
        hasPriorWait={false}
        onOpenChange={vi.fn()}
        onApply={vi.fn()}
        renderSequence={() => <p>分支子画布</p>}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "全局配置：提取消息变量前，所有到达路径都必须先有成功的等待消息节点。",
    );
    expect(screen.queryByText("还需完成 1 项配置")).toBeNull();
  });

  it("将多条配置错误收纳到 popover", () => {
    const step = createDefaultConditionStep();
    step.branches.splice(1, 0, {
      kind: "else_if",
      name: "余额不足",
      logic: "and",
      conditions: [createDefaultRule()],
      steps: [],
    });
    const firstRule = step.branches[0].conditions?.[0];
    if (!firstRule) throw new Error("默认条件规则缺失");
    firstRule.variable = "";
    step.branches[1].conditions = [];

    render(
      <ConditionWorkspace
        step={step}
        open
        hasPriorWait={false}
        onOpenChange={vi.fn()}
        onApply={vi.fn()}
        renderSequence={() => <p>分支子画布</p>}
      />,
    );

    const trigger = screen.getByRole("button", { name: /还需完成 \d+ 项配置/ });
    expect(trigger).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "1 项配置错误" })).toHaveLength(2);
    expect(screen.queryByText("配置错误")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByText("配置错误（按分支）")).toBeTruthy();
    expect(screen.getByText("满足条件：请选择已提取的变量。")).toBeTruthy();
    expect(screen.getByText("余额不足：每个判断分支必须有 1–10 条条件。")).toBeTruthy();
  });
});
