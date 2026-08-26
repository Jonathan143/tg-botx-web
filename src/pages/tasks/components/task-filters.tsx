import { SearchIcon } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function TaskFilters({
  query,
  status,
  onQueryChange,
  onStatusChange,
}: {
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <InputGroup className="w-full lg:max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索任务、账号或目标"
          aria-label="搜索任务"
        />
      </InputGroup>
      <ToggleGroup
        value={[status]}
        onValueChange={(values) => values[0] && onStatusChange(values[0])}
        aria-label="任务状态"
      >
        <ToggleGroupItem value="all">全部</ToggleGroupItem>
        <ToggleGroupItem value="enabled">已启用</ToggleGroupItem>
        <ToggleGroupItem value="disabled">已停用</ToggleGroupItem>
        <ToggleGroupItem value="archived">已归档</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
