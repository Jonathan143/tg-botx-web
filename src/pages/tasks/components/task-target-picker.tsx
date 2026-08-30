import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiRequest } from "@/lib/api/client";
import type { Account, AccountChat } from "@/lib/api/types";

type ChatType = "all" | "bot" | "group" | "private";

function LazyAvatar({
  src,
  className,
  root,
}: {
  src: string;
  className: string;
  root?: Element | null;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const image = imageRef.current;
    if (!image) return;
    // When a scroll container is supplied, wait until its ref is attached
    // before observing. Otherwise the observer would use the viewport root.
    if (root === null && root !== undefined) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { root: root ?? null, rootMargin: "0px", threshold: 0 },
    );
    observer.observe(image);

    return () => observer.disconnect();
  }, [root, shouldLoad]);

  return (
    <img
      ref={imageRef}
      src={shouldLoad ? src : undefined}
      alt=""
      decoding="async"
      className={className}
    />
  );
}

export function TaskTargetPicker({
  account,
  target,
  onTargetChange,
}: {
  account?: Account;
  target: string;
  onTargetChange: (target: string) => void;
}) {
  const [chatType, setChatType] = useState<ChatType>("all");
  const [chatSearch, setChatSearch] = useState("");
  const [submittedChatSearch, setSubmittedChatSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatListElement, setChatListElement] = useState<HTMLDivElement | null>(null);
  const accountId = account?.id;
  const targetSearch = target.trim();
  const accountChatsEnabled = dialogOpen && Boolean(accountId && account.active);
  const isDefaultDialogQuery = chatType === "all" && !submittedChatSearch;
  const chatsQuery = useQuery({
    queryKey: ["account-chats", accountId, "all"],
    queryFn: () =>
      apiRequest<{ items: AccountChat[] }>(`/api/accounts/${accountId}/chats?type=all&limit=200`),
    // 目标选择弹框未打开时不需要加载聊天列表。
    enabled: accountChatsEnabled,
    staleTime: 60_000,
  });
  const dialogChatsQuery = useQuery({
    queryKey: ["account-chats", accountId, chatType, submittedChatSearch],
    queryFn: () => {
      const params = new URLSearchParams({ type: chatType, limit: "200" });
      if (submittedChatSearch) params.set("query", submittedChatSearch);
      return apiRequest<{ items: AccountChat[] }>(
        `/api/accounts/${accountId}/chats?${params.toString()}`,
      );
    },
    // 默认的“全部”列表由 chatsQuery 提供，避免同一接口重复请求。
    enabled: accountChatsEnabled && !isDefaultDialogQuery,
    staleTime: 30_000,
  });
  const targetChatQuery = useQuery({
    queryKey: ["account-chat", accountId, targetSearch],
    queryFn: () => {
      const params = new URLSearchParams({ type: "all", limit: "50" });
      params.set("query", targetSearch);
      return apiRequest<{ items: AccountChat[] }>(
        `/api/accounts/${accountId}/chats?${params.toString()}`,
      );
    },
    // 编辑已有任务时弹框不会自动打开，仍需加载当前目标的元数据来展示头像。
    // 弹框打开后由列表查询提供数据，避免额外请求。
    enabled: Boolean(accountId && account.active && targetSearch && !dialogOpen),
    staleTime: 60_000,
  });
  const visibleChatsQuery = isDefaultDialogQuery ? chatsQuery : dialogChatsQuery;
  const selectedChat = useMemo(() => {
    const chats = [
      ...(chatsQuery.data?.items ?? []),
      ...(dialogChatsQuery.data?.items ?? []),
      ...(targetChatQuery.data?.items ?? []),
    ];
    return chats.find((chat) => chat.username === targetSearch || chat.id === targetSearch);
  }, [
    chatsQuery.data?.items,
    dialogChatsQuery.data?.items,
    targetChatQuery.data?.items,
    targetSearch,
  ]);

  useEffect(() => {
    if (!accountId) return;
    setChatType("all");
    setChatSearch("");
    setSubmittedChatSearch("");
    setDialogOpen(false);
  }, [accountId]);

  const selectTarget = (chat: AccountChat) => {
    onTargetChange(chat.username ?? chat.id);
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button
            id="task-target"
            type="button"
            variant="outline"
            className="h-auto min-h-14 w-full justify-start px-3 py-2 text-left"
            disabled={!account?.active}
          />
        }
      >
        {selectedChat?.avatarUrl ? (
          <LazyAvatar
            src={selectedChat.avatarUrl}
            className="size-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium uppercase">
            {(selectedChat?.title ?? target ?? "?").slice(0, 1)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {(selectedChat?.title ?? target) || "请选择目标聊天"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {selectedChat?.username ??
              (selectedChat ? `ID ${selectedChat.id}` : target || "点击选择目标")}
          </span>
        </span>
        <span className="text-muted-foreground">更换</span>
      </DialogTrigger>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择目标聊天</DialogTitle>
          <DialogDescription>
            从 {account?.name ?? "当前账号"} 的对话中搜索并选择目标。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <ToggleGroup
              value={[chatType]}
              onValueChange={(values) => values[0] && setChatType(values[0] as ChatType)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="bot">Bot</ToggleGroupItem>
              <ToggleGroupItem value="group">群聊</ToggleGroupItem>
              <ToggleGroupItem value="private">私聊</ToggleGroupItem>
            </ToggleGroup>
            <Input
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                setSubmittedChatSearch(event.currentTarget.value.trim());
              }}
              placeholder="输入名称、@用户名或 ID，按回车搜索"
              aria-label="搜索账号对话"
              className="sm:flex-1"
              autoFocus
            />
          </div>
          <div
            ref={setChatListElement}
            className="h-[min(55vh,480px)] overflow-y-auto no-scrollbar rounded-lg border"
          >
            {visibleChatsQuery.isPending ? (
              <div className="p-8 text-center text-sm text-muted-foreground">正在加载对话…</div>
            ) : visibleChatsQuery.isError ? (
              <div className="p-8 text-center text-sm text-destructive">
                对话加载失败，请稍后重试。
              </div>
            ) : visibleChatsQuery.data?.items.length ? (
              <div className="divide-y">
                {visibleChatsQuery.data.items.map((chat) => (
                  <button
                    key={`${chat.type}-${chat.id}`}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                    onClick={() => selectTarget(chat)}
                  >
                    {chat.avatarUrl ? (
                      <LazyAvatar
                        src={chat.avatarUrl}
                        className="size-10 shrink-0 rounded-full object-cover"
                        root={chatListElement}
                      />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium uppercase">
                        {chat.title.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{chat.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {chat.username ?? `ID ${chat.id}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {chat.type === "bot" ? "Bot" : chat.type === "group" ? "群聊" : "私聊"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">没有匹配的对话</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
