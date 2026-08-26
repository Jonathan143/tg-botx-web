import { DownloadIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function LogFilters({
  query,
  level,
  live,
  onQueryChange,
  onLevelChange,
  onLiveChange,
  onDownload,
}: {
  query: string;
  level: string;
  live: boolean;
  onQueryChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onLiveChange: (value: boolean) => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <InputGroup className="w-full xl:max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索日志内容或请求 ID"
            aria-label="搜索日志"
          />
        </InputGroup>
        <ToggleGroup
          value={[level]}
          onValueChange={(values) => values[0] && onLevelChange(values[0])}
        >
          <ToggleGroupItem value="all">全部</ToggleGroupItem>
          <ToggleGroupItem value="INFO">信息</ToggleGroupItem>
          <ToggleGroupItem value="WARNING">警告</ToggleGroupItem>
          <ToggleGroupItem value="ERROR">错误</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-1 items-center justify-between gap-3 xl:justify-end">
          <Field orientation="horizontal" className="w-auto">
            <Switch id="live-logs" checked={live} onCheckedChange={onLiveChange} />
            <FieldLabel htmlFor="live-logs">实时追踪</FieldLabel>
          </Field>
          <Button variant="outline" onClick={onDownload}>
            <DownloadIcon data-icon="inline-start" />
            下载轮转日志
          </Button>
        </div>
      </div>
    </div>
  );
}
