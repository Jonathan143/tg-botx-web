import type { BotCommand } from "@/lib/api/types";

export type CommandRole = "anonymous" | "user" | "admin";

export type CommandDraft = Pick<BotCommand, "description" | "enabled"> & {
  allowedRoles: CommandRole[];
};

export const ROLE_OPTIONS: Array<{ value: CommandRole; label: string }> = [
  { value: "anonymous", label: "未绑定用户" },
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

export function toCommandDraft(item: BotCommand): CommandDraft {
  return {
    description: item.description,
    enabled: item.enabled,
    allowedRoles: item.allowedRoles.filter((role): role is CommandRole =>
      ROLE_OPTIONS.some((option) => option.value === role),
    ),
  };
}

