import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/resource-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { messageLibraryApi, messageLibraryKey } from "@/lib/api/message-library";
import type { MessageGroupSummary } from "@/lib/message-library";
import { GroupEditorDialog } from "./components/group-editor-dialog";
import { GroupList } from "./components/group-list";

export default function MessageLibraryPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const query = useQuery({
    queryKey: [...messageLibraryKey, "groups"],
    queryFn: ({ signal }) => messageLibraryApi.list(signal),
    staleTime: 0,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: messageLibraryKey });
  };
  const remove = async (group: MessageGroupSummary) => {
    setIsDeleting(true);
    try {
      await messageLibraryApi.delete(group.id, group.revision);
      await refresh();
      toast.add({ type: "success", title: "分组已删除" });
    } catch (error) {
      toast.add({
        type: "error",
        title: "删除失败",
        description: error instanceof Error ? error.message : "请刷新后重试。",
      });
      await refresh();
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <>
      <PageHeader
        title="消息库"
        description="按分组管理随机消息，在任务中选择一次性导入或实时引用。"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCwIcon className="size-4" />
              刷新
            </Button>
            <Button type="button" onClick={() => setEditing({ id: null })}>
              <PlusIcon className="size-4" />
              新建分组
            </Button>
          </>
        }
      />
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isError && query.data ? (
        <Alert variant="destructive">
          <AlertDescription>刷新失败，当前显示缓存数据：{query.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {query.data ? (
        <GroupList
          groups={query.data.items}
          onEdit={(group) => setEditing({ id: group.id })}
          onDelete={remove}
          isDeleting={isDeleting}
        />
      ) : null}
      {editing ? (
        <GroupEditorDialog
          key={editing.id ?? "new"}
          groupId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            toast.add({ type: "success", title: "消息分组已保存" });
          }}
        />
      ) : null}
    </>
  );
}
