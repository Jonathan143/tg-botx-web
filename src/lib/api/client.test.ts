import { afterEach, describe, expect, it, vi } from "vitest";

import { type ApiError, apiRequest, onAuthRequired, setCsrfToken } from "./client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCsrfToken(null);
  });

  it("在修改请求中附带内存 CSRF Token", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setCsrfToken("csrf-value");
    await apiRequest("/api/tasks/1/enable", { method: "POST", body: "{}" });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });

  it("401 时通知认证层并保留稳定错误码与请求 ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "AUTH_REQUIRED", message: "需要解锁", requestId: "req-1" },
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const listener = vi.fn();
    const unsubscribe = onAuthRequired(listener);
    await expect(apiRequest("/api/tasks")).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      requestId: "req-1",
    } satisfies Partial<ApiError>);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
