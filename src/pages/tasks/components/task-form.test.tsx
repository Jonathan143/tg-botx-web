import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskForm } from "./task-form";

describe("TaskForm", () => {
  it("在名称与目标为空时不提交", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<TaskForm submitLabel="创建任务" isSubmitting={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
    expect(await screen.findByText("任务名称、账号和目标不能为空。")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
