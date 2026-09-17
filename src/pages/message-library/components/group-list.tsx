import { FolderIcon, PencilIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { DataPagination } from "@/components/data-pagination";
import { EmptyState } from "@/components/resource-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { MessageGroupSummary } from "@/lib/message-library";

export function GroupList({
  groups,
  onEdit,
  onDelete,
  isDeleting,
}: {
  groups: MessageGroupSummary[];
  onEdit: (group: MessageGroupSummary) => void;
  onDelete: (group: MessageGroupSummary) => Promise<void>;
  isDeleting: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = groups.filter((group) =>
    group.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 25)));
  return (
    <section className="space-y-4" aria-label="消息分组">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            placeholder="搜索分组名称"
            aria-label="搜索消息分组"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {groups.length} 个分组 · {groups.reduce((total, group) => total + group.messageCount, 0)}{" "}
          条消息
        </p>
      </div>
      {!groups.length ? (
        <EmptyState
          title="还没有消息分组"
          description="新建一个分组，添加消息后即可用于任务中的随机发送。"
        />
      ) : !filtered.length ? (
        <EmptyState title="没有匹配的分组" description="尝试更换搜索关键词。" />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>分组名称</TableHead>
                <TableHead>消息数量</TableHead>
                <TableHead>最近更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice((visiblePage - 1) * 25, visiblePage * 25).map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      className="max-w-80 justify-start"
                      onClick={() => onEdit(group)}
                    >
                      <FolderIcon className="size-4 shrink-0" />
                      <span className="truncate">{group.name}</span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={group.messageCount ? "secondary" : "outline"}>
                      {group.messageCount} 条
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(group.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(group)}
                      >
                        <PencilIcon className="size-4" />
                        管理消息
                      </Button>
                      <ConfirmAction
                        title={`删除“${group.name}”？`}
                        description="将删除分组及其中所有消息。已导入任务的独立快照不受影响；仍被任务实时引用的分组无法删除。"
                        actionLabel="确认删除"
                        triggerLabel="删除"
                        triggerContent={<Trash2Icon className="size-4" />}
                        triggerAriaLabel={`删除分组 ${group.name}`}
                        triggerDisabled={isDeleting}
                        variant="destructive"
                        onConfirm={() => onDelete(group)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <DataPagination
        page={visiblePage}
        pageSize={25}
        total={filtered.length}
        onPageChange={setPage}
      />
    </section>
  );
}
