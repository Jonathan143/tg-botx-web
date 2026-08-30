import { FileUpIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

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
import { cn } from "@/lib/utils";

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
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isPending || isReadingFile;

  const handleFile = async (file: File) => {
    const isYamlFile =
      /\.(?:yaml|yml)$/i.test(file.name) ||
      ["application/yaml", "application/x-yaml", "text/yaml", "text/x-yaml"].includes(file.type);
    if (!isYamlFile) {
      toast.add({
        type: "error",
        title: "文件格式不支持",
        description: "请选择 .yaml 或 .yml 文件。",
      });
      return;
    }

    setIsReadingFile(true);
    try {
      const content = await file.text();
      setYaml(content);
      setPreflight(null);
      setAllowOverwrite(false);
      toast.add({
        type: "success",
        title: "YAML 文件已读取",
        description: `已加载 ${file.name}`,
      });
    } catch (error) {
      toast.add({
        type: "error",
        title: "读取文件失败",
        description: error instanceof Error ? error.message : "无法读取该文件，请重试。",
      });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  };

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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setIsDragging(false);
      }}
    >
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
            <div
              role="button"
              tabIndex={isBusy ? -1 : 0}
              aria-label="上传 YAML 文件"
              aria-disabled={isBusy}
              onClick={() => {
                if (!isBusy) fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (!isBusy && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!isBusy) setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isBusy) setIsDragging(true);
              }}
              onDragLeave={(event) => {
                const relatedTarget = event.relatedTarget;
                if (
                  !(relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget))
                ) {
                  setIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (!isBusy) {
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
                "bg-muted/20 text-muted-foreground hover:bg-muted/50",
                isDragging && "border-primary bg-primary/5 text-primary",
                isBusy && "pointer-events-none opacity-60",
              )}
            >
              <UploadIcon aria-hidden="true" />
              <span className="text-sm font-medium">
                {isReadingFile
                  ? "正在读取文件…"
                  : isDragging
                    ? "松开以上传 YAML 文件"
                    : "拖拽 YAML 文件到这里，或点击选择"}
              </span>
              <span className="text-xs">支持 .yaml 和 .yml 格式</span>
            </div>
            <input
              ref={fileInputRef}
              id="import-yaml-file"
              type="file"
              accept=".yaml,.yml,application/yaml,application/x-yaml,text/yaml,text/x-yaml"
              className="sr-only"
              aria-label="选择 YAML 文件"
              onChange={handleFileChange}
              disabled={isBusy}
            />
            <Textarea
              id="import-yaml"
              className="h-72 font-mono text-xs"
              value={yaml}
              onChange={(event) => {
                setYaml(event.target.value);
                setPreflight(null);
                setAllowOverwrite(false);
              }}
            />
            <FieldDescription>
              支持与 CLI 导入相同的 TaskDefinition 格式，也可以直接粘贴或编辑 YAML。
            </FieldDescription>
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
          <Button variant="outline" onClick={handlePreflight} disabled={!yaml.trim() || isBusy}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}预检
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !preflight?.valid ||
              (Boolean(preflight.conflicts.length) && !allowOverwrite) ||
              isBusy
            }
          >
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
