import { apiRequest, jsonBody } from "@/lib/api/client";
import type { MessageGroup, MessageGroupInput, MessageGroupSummary } from "@/lib/message-library";

const base = "/api/message-library/groups";
export const messageLibraryKey = ["message-library"] as const;

export const messageLibraryApi = {
  list: (signal?: AbortSignal) => apiRequest<{ items: MessageGroupSummary[] }>(base, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest<MessageGroup>(`${base}/${encodeURIComponent(id)}`, { signal }),
  create: (input: MessageGroupInput) =>
    apiRequest<MessageGroup>(base, { method: "POST", body: jsonBody(input) }),
  update: (id: string, input: MessageGroupInput, revision: number) =>
    apiRequest<MessageGroup>(`${base}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: jsonBody({ ...input, revision }),
    }),
  delete: (id: string, revision: number) =>
    apiRequest<{ deleted: boolean }>(`${base}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: jsonBody({ revision }),
    }),
};
