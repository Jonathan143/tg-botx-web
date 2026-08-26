import type { ApiErrorPayload } from "./types";

let csrfToken: string | null = null;
const authRequiredListeners = new Set<() => void>();

export class ApiError extends Error {
  code: string;
  requestId?: string;
  status: number;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? "请求未能完成，请稍后重试。");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error?.code ?? "UNKNOWN_ERROR";
    this.requestId = payload.error?.requestId;
    this.details = payload.error?.details;
  }
}

export function setCsrfToken(value: string | null) {
  csrfToken = value;
}

export function onAuthRequired(listener: () => void) {
  authRequiredListeners.add(listener);
  return () => {
    authRequiredListeners.delete(listener);
  };
}

function isMutation(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (isMutation(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401) {
    setCsrfToken(null);
    for (const listener of authRequiredListeners) {
      listener();
    }
  }

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }
    throw new ApiError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export async function downloadFromApi(path: string, fallbackName: string) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }
    throw new ApiError(response.status, payload);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const fileName = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
