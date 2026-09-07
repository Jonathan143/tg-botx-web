import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDefaultConditionStep, type WorkflowStep } from "@/lib/workflow-condition";
import { TaskWorkflowEditor } from "./task-workflow-editor";
import { TaskForm } from "./task-form";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
afterEach(cleanup);
const http: WorkflowStep = { type: "http_request", node_id: "http1", url: "https://example.test" };
const extract: WorkflowStep = {
  type: "extract_variable",
  node_id: "extract1",
  name: "result",
  source: "http_body",
  source_node_id: "http1",
  value_type: "text",
};

it("edits an extraction in a nested branch using the outer HTTP source", () => {
  const onChange = vi.fn();
  const nested = createDefaultConditionStep();
  nested.extracts = [];
  nested.branches[0].steps = [extract];
  const outer = createDefaultConditionStep();
  outer.branches[0].steps = [nested];
  render(
    <TaskWorkflowEditor
      steps={[
        { type: "wait_message", node_id: "wait1", success: "ok", timeout_seconds: 60 },
        http,
        outer,
      ]}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /步骤 3 · 条件判断/ }));
  fireEvent.click(screen.getByRole("button", { name: /满足条件/ }));
  fireEvent.click(screen.getByRole("button", { name: /步骤 1 · 条件判断/ }));
  fireEvent.click(screen.getByRole("button", { name: /步骤 1 · 提取变量/ }));
  fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
  expect(screen.queryByText("所选 HTTP 请求数据源节点无效，请重新选择。")).toBeNull();
  expect(screen.queryByRole("button", { name: "完成编辑" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "应用条件配置" }));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0][0][2].branches[0].steps[0].branches[0].steps[0]).toMatchObject(
    extract,
  );
});

it.each(["visual", "yaml"])(
  "blocks saving a deleted source in %s mode without opening the node editor",
  async (mode) => {
    const onSubmit = vi.fn(async () => undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TaskForm
          submitLabel="创建任务"
          isSubmitting={false}
          onSubmit={onSubmit}
          initialValue={{
            name: "review",
            account: "default",
            target: "@review",
            schedule: { type: "fixed", time: "09:00:00", timezone: "UTC" },
            steps: [extract],
            retry: { max_attempts: 3, backoff_seconds: [30, 60, 120] },
            notifications: { failure: true, success: false },
          }}
        />
      </QueryClientProvider>,
    );
    if (mode === "yaml") fireEvent.click(screen.getByRole("tab", { name: /YAML/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
    expect(await screen.findByText(/所选 HTTP 请求数据源节点无效/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  },
);
