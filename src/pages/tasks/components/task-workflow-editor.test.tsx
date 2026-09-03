import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StepEditorSheet } from "./task-workflow-editor";

describe("StepEditorSheet", () => {
  it("编辑等待消息匹配规则时保持输入框焦点", () => {
    render(
      <StepEditorSheet
        step={{ type: "wait_message", timeout_seconds: 60 }}
        index={0}
        open
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "成功匹配规则 1" });
    input.focus();
    fireEvent.change(input, { target: { value: "签" } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue("签");
  });
});
