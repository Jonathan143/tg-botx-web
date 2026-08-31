import { EmptyState } from "@/components/resource-state";
import { StatusBadge } from "@/components/status-badge";
import type { LogEntry } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export function LogViewer({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0)
    return <EmptyState title="没有匹配的日志" description="调整筛选条件，或开启实时追踪。" />;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[calc(100svh-18rem)] overflow-auto font-mono text-xs">
        {entries.map((entry, index) => (
          <div
            key={entry.id ?? `${entry.timestamp}-${index}`}
            className="grid gap-2 border-b px-4 py-3 last:border-b-0 md:grid-cols-[10.5rem_5.5rem_1fr]"
          >
            <time
              className="whitespace-nowrap text-muted-foreground"
              dateTime={entry.timestamp ?? undefined}
            >
              {formatDateTime(entry.timestamp?.replace(/,\d+/, ""))}
            </time>
            <StatusBadge status={entry.level?.toLowerCase()} />
            <div className="min-w-0">
              <p className="whitespace-pre-wrap break-words">{entry.message}</p>
              {entry.requestId ? (
                <p className="mt-1 text-muted-foreground">requestId={entry.requestId}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
