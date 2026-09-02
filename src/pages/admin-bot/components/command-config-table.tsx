import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BotCommand } from "@/lib/api/types";

type CommandConfigTableProps = {
  commands: BotCommand[];
  savingCommand: string | null;
  onEdit: (command: BotCommand) => void;
  onReorder: (source: string, target: string) => void;
  onDelete: (command: string) => Promise<void>;
};

function formatUpdatedAt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(date);
}

const roleLabels: Record<string, string> = {
  anonymous: "未绑定用户",
  user: "普通用户",
  admin: "管理员",
};

type SortableCommandRowProps = {
  command: BotCommand;
  savingCommand: string | null;
  onEdit: (command: BotCommand) => void;
  onDelete: (command: string) => Promise<void>;
};

function SortableCommandRow({
  command: item,
  savingCommand,
  onEdit,
  onDelete,
}: SortableCommandRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.command,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
    >
      <TableCell className="py-4">
        <div className="flex items-start gap-3">
          <Button
            ref={setActivatorNodeRef}
            aria-label={`拖拽排序 /${item.command}`}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            size="icon-sm"
            type="button"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon aria-hidden />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <code className="font-semibold">/{item.command}</code>
              <Badge variant="outline">{item.type === "system" ? "系统" : "自定义"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.type === "system" ? "系统内置指令" : "后台创建指令"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal text-sm">{item.description}</TableCell>
      <TableCell className="text-center">
        <Badge
          className={item.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined}
          variant="secondary"
        >
          {item.enabled ? "启用" : "停用"}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          className={item.menuVisible ? "border-sky-200 bg-sky-50 text-sky-700" : undefined}
          variant="secondary"
        >
          {item.menuVisible ? "显示" : "隐藏"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap justify-center gap-1">
          {item.allowedRoles.map((role) => (
            <Badge key={role} variant="outline">
              {roleLabels[role] ?? role}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatUpdatedAt(item.updatedAt)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            aria-label={`编辑 /${item.command}`}
            disabled={savingCommand === item.command}
            size="icon-sm"
            variant="ghost"
            onClick={() => onEdit(item)}
          >
            <PencilIcon />
          </Button>
          {item.type === "custom" && (
            <ConfirmAction
              actionLabel="确认删除"
              description={`删除 /${item.command} 后会移除本地自定义指令配置。`}
              title={`删除 /${item.command} 指令？`}
              triggerLabel="删除"
              triggerContent={<Trash2Icon />}
              triggerAriaLabel={`删除 /${item.command}`}
              variant="destructive"
              onConfirm={() => onDelete(item.command)}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CommandConfigTable({
  commands,
  savingCommand,
  onEdit,
  onReorder,
  onDelete,
}: CommandConfigTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[220px]">指令（Command）</TableHead>
            <TableHead className="min-w-[240px]">说明（Description）</TableHead>
            <TableHead className="text-center">启用状态</TableHead>
            <TableHead className="text-center">菜单可见</TableHead>
            <TableHead className="min-w-[250px] text-center">可调用身份</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <SortableContext
          items={commands.map((item) => item.command)}
          strategy={verticalListSortingStrategy}
        >
          <TableBody>
            {commands.map((item) => (
              <SortableCommandRow
                key={item.command}
                command={item}
                onDelete={onDelete}
                onEdit={onEdit}
                savingCommand={savingCommand}
              />
            ))}
          </TableBody>
        </SortableContext>
      </Table>
    </DndContext>
  );
}
