import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultConditionStep } from "@/lib/workflow-condition";

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
    expect(screen.getByText("分支子画布")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("分支名称"), { target: { value: "余额充足" } });
    fireEvent.click(screen.getByRole("switch", { name: "严格模式" }));
    fireEvent.click(screen.getByRole("button", { name: "应用条件配置" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({
      strict: true,
      branches: [{ kind: "if", name: "余额充足" }, { kind: "else" }],
    });
  });
});
