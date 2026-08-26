import { CircleAlertIcon, InboxIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="正在加载">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 w-full lg:col-span-2" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "请求未能完成，请稍后重试。";
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>加载失败</EmptyTitle>
        <EmptyDescription>
          {message}
          {requestId ? `（请求 ID：${requestId}）` : ""}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            重新加载
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="min-h-64 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
