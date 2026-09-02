import type { BotCommand } from "@/lib/api/types";

export type CommandRole = "anonymous" | "user" | "admin";

export type CommandDraft = Pick<BotCommand, "command" | "description" | "enabled" | "menuVisible"> & {
  allowedRoles: CommandRole[];
};

export const ROLE_OPTIONS: Array<{ value: CommandRole; label: string }> = [
  { value: "anonymous", label: "未绑定用户" },
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

export function toCommandDraft(item: BotCommand): CommandDraft {
  return {
    command: item.command,
    description: item.description,
    enabled: item.enabled,
    menuVisible: item.menuVisible,
    allowedRoles: item.allowedRoles.filter((role): role is CommandRole =>
      ROLE_OPTIONS.some((option) => option.value === role),
    ),
  };
}
