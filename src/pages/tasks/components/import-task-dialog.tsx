import { FileUpIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { apiRequest, jsonBody } from "@/lib/api/client";

type Preflight = {
  valid: boolean;
  conflicts: string[];
  errors: Array<string | { path?: string; message?: string }>;
  task?: { name?: string };
};

export function ImportTaskDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [yaml, setYaml] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handlePreflight = async () => {
    setIsPending(true);
    try {
      setPreflight(
        await apiRequest<Preflight>("/api/tasks/import/preflight", {
          method: "POST",
          body: jsonBody({ yaml }),
        }),
      );
    } catch (error) {
      toast.add({
        type: "error",
        title: "预检失败",
        description: error instanceof Error ? error.message : "请检查 YAML。",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleImport = async () => {
    setIsPending(true);
    try {
      await apiRequest("/api/tasks/import", {
        method: "POST",
        body: jsonBody({
          yaml,
          overwriteNames: allowOverwrite ? (preflight?.conflicts ?? []) : [],
        }),
      });
      toast.add({ type: "success", title: "任务已导入" });
      setOpen(false);
      setYaml("");
      setPreflight(null);
      onImported();
    } catch (error) {
      toast.add({
        type: "error",
        title: "导入失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    } finally {
      setIsPending(false);
    }
  };

  const errorText = preflight?.errors
    .map((item) =>
      typeof item === "string"
        ? item
        : `${item.path ? `${item.path}：` : ""}${item.message ?? "配置无效"}`,
    )
    .join("；");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileUpIcon data-icon="inline-start" />
        导入 YAML
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入任务配置</DialogTitle>
          <DialogDescription>先预检配置和名称冲突，确认后才会写入数据库。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="import-yaml">YAML 配置</FieldLabel>
            <Textarea
              id="import-yaml"
              className="min-h-72 font-mono text-xs"
              value={yaml}
              onChange={(event) => {
                setYaml(event.target.value);
                setPreflight(null);
              }}
            />
            <FieldDescription>支持与 CLI 导入相同的 TaskDefinition 格式。</FieldDescription>
          </Field>
          {preflight ? (
            <Alert variant={preflight.valid ? "default" : "destructive"}>
              <AlertTitle>{preflight.valid ? "预检通过" : "配置无效"}</AlertTitle>
              <AlertDescription>
                {preflight.errors.length ? errorText : `任务：${preflight.task?.name ?? "未命名"}`}
                {preflight.conflicts.length ? `；同名冲突：${preflight.conflicts.join("、")}` : ""}
              </AlertDescription>
            </Alert>
          ) : null}
          {preflight?.conflicts.length ? (
            <Field orientation="horizontal">
              <Checkbox
                id="overwrite"
                checked={allowOverwrite}
                onCheckedChange={(checked) => setAllowOverwrite(checked === true)}
              />
              <FieldLabel htmlFor="overwrite">允许覆盖上述同名任务</FieldLabel>
            </Field>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={handlePreflight} disabled={!yaml.trim() || isPending}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}预检
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !preflight?.valid ||
              (Boolean(preflight.conflicts.length) && !allowOverwrite) ||
              isPending
            }
          >
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
