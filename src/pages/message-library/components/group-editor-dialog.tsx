import { useCallback, useEffect, useId, useRef, useState } from "react";

import { MessageListEditor } from "@/components/message-list-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { messageLibraryApi } from "@/lib/api/message-library";
import { validateMessageList } from "@/lib/message-library";

export function GroupEditorDialog({
  groupId,
  onClose,
  onSaved,
}: {
  groupId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [revision, setRevision] = useState<number | null>(null);
  const [baseline, setBaseline] = useState(JSON.stringify({ name: "", messages: [] }));
  const [isLoading, setIsLoading] = useState(Boolean(groupId));
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<"close" | "reload" | null>(null);
  const request = useRef<AbortController | null>(null);
  const isDirty = JSON.stringify({ name, messages }) !== baseline;
  const load = useCallback(async () => {
    if (!groupId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      // Read exactly once per open/reload. Background list refreshes never replace a draft.
      const group = await messageLibraryApi.get(groupId, controller.signal);
      if (controller.signal.aborted) return;
      setName(group.name);
      setMessages(group.messages);
      setRevision(group.revision);
      setBaseline(JSON.stringify({ name: group.name, messages: group.messages }));
      setSaveError(null);
      setIsConflict(false);
    } catch (error) {
      if (!controller.signal.aborted)
        setLoadError(error instanceof Error ? error.message : "分组加载失败。");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [groupId]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const close = () => {
    if (isSaving) return;
    if (isDirty) setConfirmation("close");
    else onClose();
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || isLoading || loadError) return;
    setSaveError(null);
    const trimmedName = name.trim();
    const issues = validateMessageList(messages, true);
    if (!trimmedName || trimmedName.length > 100) {
      setSaveError("分组名称必须为 1–100 个字符。");
      return;
    }
    if (issues.length) {
      setSaveError(issues.slice(0, 10).join("\n"));
      return;
    }
    if (groupId && revision === null) {
      setSaveError("请先重新载入分组。");
      return;
    }
    setIsSaving(true);
    try {
      const input = { name: trimmedName, messages };
      if (groupId && revision !== null) await messageLibraryApi.update(groupId, input, revision);
      else await messageLibraryApi.create(input);
      await onSaved();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败，请重试。");
      setIsConflict(error instanceof ApiError && error.status === 409);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="flex max-h-[90dvh] flex-col sm:max-w-3xl"
          showCloseButton={!isSaving}
        >
          <DialogHeader>
            <DialogTitle>{groupId ? "管理消息分组" : "新建消息分组"}</DialogTitle>
            <DialogDescription>
              每组最多 1000
              条。保存后，实时引用此分组的任务会在后续发送时使用新内容；已导入的独立快照不变。
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col gap-4"
            onSubmit={(event) => void save(event)}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
              {isLoading ? (
                <p className="flex items-center gap-2 p-4 text-sm" role="status">
                  <Spinner />
                  正在加载消息…
                </p>
              ) : loadError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {loadError}
                    <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                      重试
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`${id}-name`}>分组名称</FieldLabel>
                    <Input
                      id={`${id}-name`}
                      value={name}
                      maxLength={100}
                      disabled={isSaving}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="例如：每日问候、签到指令"
                    />
                    <FieldDescription>
                      名称不可重复。空分组可以保存，但不能用于随机发送。
                    </FieldDescription>
                  </Field>
                  <MessageListEditor value={messages} onChange={setMessages} disabled={isSaving} />
                </FieldGroup>
              )}
              {saveError ? (
                <Alert variant="destructive">
                  <AlertDescription className="whitespace-pre-wrap" role="alert">
                    {saveError}
                  </AlertDescription>
                </Alert>
              ) : null}
              {isConflict && groupId ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => setConfirmation("reload")}
                  >
                    重新载入分组
                  </Button>
                  <p className="text-xs text-muted-foreground">会放弃当前草稿，读取最新版本。</p>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSaving} onClick={close}>
                取消
              </Button>
              <Button type="submit" disabled={isSaving || isLoading || Boolean(loadError)}>
                {isSaving ? <Spinner /> : null}保存分组
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃当前未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === "reload"
                ? "重新载入会用服务器最新版本替换当前草稿。"
                : "关闭后，当前未保存的修改将丢失。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirmation;
                setConfirmation(null);
                if (action === "reload") void load();
                else onClose();
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
