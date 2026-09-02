import { GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BotCommand } from "@/lib/api/types";
import type { CommandDraft, CommandRole } from "./command-config-types";
import { ROLE_OPTIONS } from "./command-config-types";

type CommandConfigTableProps = {
  commands: BotCommand[];
  drafts: Record<string, CommandDraft>;
  savingCommand: string | null;
  onDraftChange: (command: string, draft: CommandDraft) => void;
  onSave: (command: string, draft: CommandDraft) => void;
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

export function CommandConfigTable({
  commands,
  drafts,
  savingCommand,
  onDraftChange,
  onSave,
  onDelete,
}: CommandConfigTableProps) {
  return (
    <Table>
      <TableHeader className="bg-muted/30">
        <TableRow>
          <TableHead className="w-[220px]">指令（Command）</TableHead>
          <TableHead className="min-w-[240px]">说明（Description）</TableHead>
          <TableHead className="text-center">菜单可见</TableHead>
          <TableHead className="min-w-[250px] text-center">可调用身份</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>更新时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {commands.map((item) => {
          const draft = drafts[item.command] ?? {
            description: item.description,
            enabled: item.enabled,
            allowedRoles: [],
          };
          const changed =
            draft.description !== item.description ||
            draft.enabled !== item.enabled ||
            draft.allowedRoles.join(",") !== item.allowedRoles.join(",");
          return (
            <CommandConfigRow
              changed={changed}
              draft={draft}
              item={item}
              key={item.command}
              saving={savingCommand === item.command}
              onDelete={onDelete}
              onDraftChange={onDraftChange}
              onSave={onSave}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

type CommandConfigRowProps = {
  item: BotCommand;
  draft: CommandDraft;
  changed: boolean;
  saving: boolean;
  onDraftChange: (command: string, draft: CommandDraft) => void;
  onSave: (command: string, draft: CommandDraft) => void;
  onDelete: (command: string) => Promise<void>;
};

function CommandConfigRow({
  item,
  draft,
  changed,
  saving,
  onDraftChange,
  onSave,
  onDelete,
}: CommandConfigRowProps) {
  const updateRoles = (role: CommandRole, checked: boolean) => {
    const roles = checked
      ? [...new Set([...draft.allowedRoles, role])]
      : draft.allowedRoles.filter((value) => value !== role);
    onDraftChange(item.command, { ...draft, allowedRoles: roles });
  };

  return (
    <TableRow>
      <TableCell className="py-4">
        <div className="flex items-start gap-3">
          <GripVerticalIcon aria-hidden className="mt-1 size-4 text-muted-foreground" />
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
      <TableCell>
        <Input
          aria-label={`/${item.command} 指令说明`}
          className="min-w-52"
          maxLength={256}
          value={draft.description}
          onChange={(event) => onDraftChange(item.command, { ...draft, description: event.target.value })}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          aria-label={`启用 /${item.command}`}
          checked={draft.enabled}
          onCheckedChange={(enabled) => onDraftChange(item.command, { ...draft, enabled })}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-center gap-4">
          {ROLE_OPTIONS.map((option) => (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" key={option.value}>
              <Checkbox
                aria-label={`${option.label}可调用 /${item.command}`}
                checked={draft.allowedRoles.includes(option.value)}
                onCheckedChange={(checked) => updateRoles(option.value, Boolean(checked))}
              />
              <span className="hidden xl:inline">{option.label}</span>
            </label>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          className={draft.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined}
          variant="secondary"
        >
          {draft.enabled ? "启用" : "停用"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatUpdatedAt(item.updatedAt)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            aria-label={`编辑 /${item.command}`}
            disabled={!changed || saving || !draft.description.trim()}
            size="icon-sm"
            variant="ghost"
            onClick={() => onSave(item.command, { ...draft, description: draft.description.trim() })}
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
