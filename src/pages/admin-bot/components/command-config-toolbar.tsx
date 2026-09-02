import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type CommandConfigToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onlyEnabled: boolean;
  onOnlyEnabledChange: (value: boolean) => void;
  group: "all" | "system" | "custom";
  onGroupChange: (value: "all" | "system" | "custom") => void;
  onCreate: () => void;
};

const groupOptions = [
  { label: "全部指令分组", value: "all" },
  { label: "系统指令", value: "system" },
  { label: "自定义指令", value: "custom" },
];

export function CommandConfigToolbar({
  search,
  onSearchChange,
  onlyEnabled,
  onOnlyEnabledChange,
  group,
  onGroupChange,
  onCreate,
}: CommandConfigToolbarProps) {
  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center w-full justify-between">
      <div className="flex items-center gap-3 flex-wrap flex-1">
        <InputGroup className="w-full lg:max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="搜索指令或说明"
            placeholder="搜索指令或说明"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </InputGroup>
        <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <Switch
            aria-label="仅看启用指令"
            checked={onlyEnabled}
            onCheckedChange={onOnlyEnabledChange}
          />
          仅看启用
        </label>
        <Select
          value={group}
          items={groupOptions}
          onValueChange={(value) => onGroupChange(value as typeof group)}
        >
          <SelectTrigger aria-label="指令分组" className="min-w-36">
            <SelectValue placeholder="全部指令分组" />
          </SelectTrigger>
          <SelectContent>
            {groupOptions.map((item) => (
              <SelectItem value={item.value} key={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* <Button aria-label="筛选" size="icon" variant="outline">
          <FilterIcon />
        </Button> */}
      </div>

      <Button className="w-full lg:w-auto" onClick={onCreate}>
        <PlusIcon data-icon="inline-start" />
        新增指令
      </Button>
    </div>
  );
}
