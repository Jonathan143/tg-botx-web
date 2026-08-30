import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskForm } from "./task-form";

describe("TaskForm", () => {
  it("在名称与目标为空时不提交", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TaskForm submitLabel="创建任务" isSubmitting={false} onSubmit={onSubmit} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
    expect(await screen.findByText("任务名称、账号和目标不能为空。")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
