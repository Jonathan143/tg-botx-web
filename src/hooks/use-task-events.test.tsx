import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/toast";
import type { Task } from "@/lib/api/types";
import { useTaskEvents } from "./use-task-events";

class EventSourceMock {
  static instances: EventSourceMock[] = [];

  readonly listeners = new Map<string, EventListener>();
  readonly close = vi.fn();
  readonly url: string;
  readonly options?: EventSourceInit;

  constructor(url: string, options?: EventSourceInit) {
    this.url = url;
    this.options = options;
    EventSourceMock.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  emit(type: string, data: string) {
    this.listeners.get(type)?.(new MessageEvent(type, { data }));
  }
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    name: "测试任务",
    account: "account",
    target: "target",
    schedule: { type: "fixed", timezone: "Asia/Shanghai", time: "12:00" },
    enabled: true,
    archived: false,
    running: false,
    nextRunAt: null,
    lastRunAt: null,
    lastStatus: null,
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
    ...overrides,
  };
}

describe("useTaskEvents", () => {
  beforeEach(() => {
    EventSourceMock.instances = [];
    vi.stubGlobal("EventSource", EventSourceMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("通过 SSE 更新对应任务的查询缓存", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["task", "task-1"], createTask());
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { unmount } = renderHook(() => useTaskEvents("task-1"), { wrapper });
    const source = EventSourceMock.instances[0];
    expect(source.url).toBe("/api/tasks/task-1/events");
    expect(source.options).toEqual({ withCredentials: true });

    const updatedTask = createTask({ running: true, lastStatus: "running" });
    act(() => source.emit("task.updated", JSON.stringify(updatedTask)));

    expect(queryClient.getQueryData(["task", "task-1"])).toEqual(updatedTask);
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
    expect(source.listeners.has("task.updated")).toBe(false);
  });

  it("忽略其他任务和无法解析的事件", () => {
    const queryClient = new QueryClient();
    const originalTask = createTask();
    queryClient.setQueryData(["task", "task-1"], originalTask);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useTaskEvents("task-1"), { wrapper });
    const source = EventSourceMock.instances[0];
    act(() => {
      source.emit("task.updated", "not-json");
      source.emit("task.updated", JSON.stringify(createTask({ id: "task-2", running: true })));
    });

    expect(queryClient.getQueryData(["task", "task-1"])).toEqual(originalTask);
  });

  it("任务由运行中变为结束时提示执行结果", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["task", "task-1"], createTask({ running: true }));
    const addToast = vi.spyOn(toast, "add");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useTaskEvents("task-1"), { wrapper });
    const source = EventSourceMock.instances[0];
    act(() => {
      source.emit(
        "task.updated",
        JSON.stringify(createTask({ running: false, lastStatus: "success" })),
      );
    });

    expect(addToast).toHaveBeenCalledWith({
      type: "success",
      title: "任务执行成功",
      timeout: 4_000,
    });
  });

  it("没有任务 ID 时不建立连接", () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useTaskEvents(undefined), { wrapper });

    expect(EventSourceMock.instances).toHaveLength(0);
  });
});
