import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGES, MAX_MESSAGE_LENGTH, validateMessageText } from "@/lib/message-library";
import { createNodeId } from "@/lib/workflow-condition";

const PAGE_SIZE = 20;

/** Shared by the message library and independent task snapshots. */
export function MessageListEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const prefix = useId();
  const [page, setPage] = useState(0);
  const [identity, setIdentity] = useState(() => ({
    value,
    keys: value.map(() => createNodeId("message")),
  }));
  // Keep row identities stable across edits and explicit removals. External
  // replacements (YAML / import) keep surviving positions but never use index keys.
  let keys = identity.keys;
  if (identity.value !== value) {
    keys = value.map((_, index) => identity.keys[index] ?? createNodeId("message"));
    setIdentity({ value, keys });
  }
  const lastPage = Math.max(0, Math.ceil(value.length / PAGE_SIZE) - 1);
  const visiblePage = Math.min(page, lastPage);
  const start = visiblePage * PAGE_SIZE;
  const change = (next: string[], nextKeys = keys) => {
    setIdentity({ value: next, keys: nextKeys });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          消息列表 · {value.length} / {MAX_MESSAGES}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || value.length >= MAX_MESSAGES}
          onClick={() => {
            change([...value, ""], [...keys, createNodeId("message")]);
            setPage(Math.floor(value.length / PAGE_SIZE));
          }}
        >
          <PlusIcon className="size-4" />
          添加消息
        </Button>
      </div>
      {!value.length ? (
        <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
          尚未添加消息。每条消息可包含多行内容。
        </p>
      ) : null}
      <div className="space-y-3">
        {value.slice(start, start + PAGE_SIZE).map((text, offset) => {
          const index = start + offset;
          const id = `${prefix}-${keys[index]}`;
          const issue = validateMessageText(text);
          return (
            <Field
              key={keys[index]}
              data-invalid={Boolean(issue)}
              className="rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={id}>消息 {index + 1}</FieldLabel>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`删除第 ${index + 1} 条消息`}
                  onClick={() =>
                    change(
                      value.filter((_, at) => at !== index),
                      keys.filter((_, at) => at !== index),
                    )
                  }
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
              <Textarea
                id={id}
                value={text}
                rows={3}
                disabled={disabled}
                aria-invalid={Boolean(issue)}
                placeholder="输入消息内容，支持多行"
                onChange={(event) =>
                  change(value.map((item, at) => (at === index ? event.target.value : item)))
                }
              />
              <div className="flex items-start justify-between gap-2 text-xs">
                {issue ? (
                  <FieldError>{issue}</FieldError>
                ) : (
                  <span className="text-muted-foreground">一条候选消息</span>
                )}
                <span className="shrink-0 text-muted-foreground">
                  {text.length} / {MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </Field>
          );
        })}
      </div>
      {lastPage > 0 ? (
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={visiblePage === 0}
            onClick={() => setPage(visiblePage - 1)}
          >
            上一页
          </Button>
          <span className="text-xs text-muted-foreground">
            {visiblePage + 1} / {lastPage + 1}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={visiblePage === lastPage}
            onClick={() => setPage(visiblePage + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  );
}
