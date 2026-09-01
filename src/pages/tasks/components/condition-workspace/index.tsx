// biome-ignore-all lint/suspicious/noArrayIndexKey: Controlled condition rows are reordered transactionally; index keys keep text inputs focused while their values change.
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskRunLog, TaskRunProgress, TaskStepStatus } from "@/lib/api/types";
import {
  CONDITION_LIMITS,
  type ConditionBranch,
  type ConditionPathSegment,
  type ConditionStep,
  createDefaultRule,
  getNestedCondition,
  normalizeConditionStep,
  updateNestedCondition,
  validateConditionStep,
  variablesAtConditionPath,
  type WorkflowStep,
  type WorkflowVariableDefinition,
  waitAtConditionPath,
} from "@/lib/workflow-condition";

import { ConditionRuleCard } from "./condition-rule-card";
import { ConditionRunSummary } from "./condition-run-summary";
import { GlobalConfig } from "./global-config";
import {
  type BranchSequenceRenderer,
  branchLabel,
  cloneCondition,
  type DeleteRequest,
  keyedEntries,
} from "./types";

export function ConditionWorkspace({
  step,
  open,
  readOnly = false,
  run,
  runLogs,
  runStatus,
  availableVariables = [],
  hasPriorWait = true,
  onOpenChange,
  onApply,
  renderSequence,
}: {
  step: WorkflowStep | null;
  open: boolean;
  readOnly?: boolean;
  run?: TaskRunProgress | null;
  runLogs?: TaskRunLog[];
  runStatus?: TaskStepStatus;
  availableVariables?: WorkflowVariableDefinition[];
  hasPriorWait?: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (step: ConditionStep) => void;
  renderSequence: BranchSequenceRenderer;
}) {
  const normalized = useMemo(
    () => (step?.type === "condition" ? normalizeConditionStep(step) : null),
    [step],
  );
  const [draft, setDraft] = useState<ConditionStep | null>(normalized);
  const [path, setPath] = useState<ConditionPathSegment[]>([]);
  const [activeBranch, setActiveBranch] = useState(0);
  const [activePanel, setActivePanel] = useState<"global" | "branch">("global");
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(normalized ? cloneCondition(normalized) : null);
    setPath([]);
    setActiveBranch(0);
    setActivePanel("global");
  }, [normalized, open]);

  const dirty = Boolean(
    draft && normalized && JSON.stringify(draft) !== JSON.stringify(normalized),
  );
  const current = useMemo(() => {
    if (!draft) return null;
    try {
      return getNestedCondition(draft, path);
    } catch {
      return draft;
    }
  }, [draft, path]);
  const variables = useMemo(
    () => (draft ? variablesAtConditionPath(draft, path, availableVariables) : []),
    [availableVariables, draft, path],
  );
  const issues = useMemo(
    () => (draft ? validateConditionStep(draft, 1, availableVariables, hasPriorWait) : []),
    [availableVariables, draft, hasPriorWait],
  );
  const currentHasWait = useMemo(
    () => (draft ? waitAtConditionPath(draft, path, hasPriorWait) : hasPriorWait),
    [draft, hasPriorWait, path],
  );
  const currentRuntimePath = useMemo(() => {
    if (!runStatus?.stepPath) return undefined;
    return path.reduce(
      (prefix, segment) => `${prefix}.branches[${segment.branchIndex}].steps[${segment.stepIndex}]`,
      runStatus.stepPath,
    );
  }, [path, runStatus?.stepPath]);
  const currentRunStatus = useMemo(() => {
    if (!current) return undefined;
    return (
      run?.stepStatuses.find(
        (status) =>
          (current.node_id && status.nodeId === current.node_id) ||
          (currentRuntimePath && status.stepPath === currentRuntimePath),
      ) ?? (path.length === 0 ? runStatus : undefined)
    );
  }, [current, currentRuntimePath, path.length, run?.stepStatuses, runStatus]);
  const currentBranch = current?.branches[activeBranch] ?? current?.branches[0];

  const updateCurrent = (next: ConditionStep) => {
    if (!draft || readOnly) return;
    setDraft(updateNestedCondition(draft, path, next));
  };
  const updateBranch = (next: ConditionBranch) => {
    if (!current) return;
    updateCurrent({
      ...current,
      branches: current.branches.map((branch, index) => (index === activeBranch ? next : branch)),
    });
  };
  const requestClose = () => {
    if (!readOnly && dirty) setConfirmClose(true);
    else onOpenChange(false);
  };
  const apply = () => {
    if (!draft || issues.length > 0) return;
    onApply(draft);
    onOpenChange(false);
  };
  const addBranch = () => {
    if (!current || current.branches.length >= CONDITION_LIMITS.branches) return;
    const firstVariable = variables[0];
    const nextBranch: ConditionBranch = {
      kind: "else_if",
      name: `条件分支 ${current.branches.length}`,
      logic: "and",
      conditions: [
        createDefaultRule(firstVariable?.name ?? "", firstVariable?.valueType ?? "text"),
      ],
      steps: [],
    };
    const nextBranches = [...current.branches];
    nextBranches.splice(nextBranches.length - 1, 0, nextBranch);
    updateCurrent({ ...current, branches: nextBranches });
    setActiveBranch(nextBranches.length - 2);
  };
  const deleteBranch = (index: number) => {
    if (!current || index <= 0 || index >= current.branches.length - 1) return;
    const nextBranches = current.branches.filter((_, itemIndex) => itemIndex !== index);
    updateCurrent({ ...current, branches: nextBranches });
    setActiveBranch(Math.max(0, Math.min(index - 1, nextBranches.length - 1)));
  };
  const moveBranch = (index: number, direction: -1 | 1) => {
    if (!current) return;
    const target = index + direction;
    if (
      index <= 0 ||
      index >= current.branches.length - 1 ||
      target <= 0 ||
      target >= current.branches.length - 1
    ) {
      return;
    }
    const next = [...current.branches];
    [next[index], next[target]] = [next[target], next[index]];
    updateCurrent({ ...current, branches: next });
    setActiveBranch(target);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="inset-2 top-2 left-2 h-[calc(100%-1rem)] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className="flex items-center gap-2">
                  <GitBranch aria-hidden="true" />
                  条件判断工作区
                  {readOnly ? <Badge variant="outline">只读</Badge> : null}
                </DialogTitle>
                <DialogDescription>
                  先提取变量，再按顺序配置 if / else if / else；命中首个分支后自动汇合。
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={requestClose}
                aria-label="关闭条件工作区"
              >
                <X />
              </Button>
            </div>
            {draft && path.length > 0 ? (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => {
                        setPath([]);
                        setActiveBranch(0);
                      }}
                    >
                      根条件
                    </Button>
                  </BreadcrumbItem>
                  {keyedEntries(
                    path,
                    (segment) => `${segment.branchIndex}-${segment.stepIndex}`,
                  ).map(({ index, key }) => {
                    const label = `嵌套条件 ${index + 1}`;
                    return (
                      <span className="contents" key={key}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {index === path.length - 1 ? (
                            <BreadcrumbPage>{label}</BreadcrumbPage>
                          ) : (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={() => {
                                setPath(path.slice(0, index + 1));
                                setActiveBranch(0);
                              }}
                            >
                              {label}
                            </Button>
                          )}
                        </BreadcrumbItem>
                      </span>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </DialogHeader>

          {current && currentBranch ? (
            <div className="grid min-h-0 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0">
                <div className="border-b p-3">
                  <Button
                    type="button"
                    variant={activePanel === "global" ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start py-2 text-left"
                    onClick={() => setActivePanel("global")}
                  >
                    <Settings2 data-icon="inline-start" />
                    全局配置
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
                  <span className="text-sm font-medium">分支</span>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={addBranch}
                      disabled={current.branches.length >= CONDITION_LIMITS.branches}
                      aria-label="添加 else if 分支"
                    >
                      <Plus />
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
                  {keyedEntries(current.branches, (branch) => JSON.stringify(branch)).map(
                    ({ item: branch, index, key }) => {
                      const selected = activePanel === "branch" && index === activeBranch;
                      const selectedAtRuntime = currentRunStatus?.selectedBranch?.index === index;
                      return (
                        <Button
                          key={key}
                          type="button"
                          variant={selected ? "secondary" : "ghost"}
                          className="h-auto min-w-40 justify-between py-2 text-left lg:min-w-0"
                          onClick={() => {
                            setActiveBranch(index);
                            setActivePanel("branch");
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{branchLabel(branch, index)}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {branch.kind === "if"
                                ? "IF"
                                : branch.kind === "else"
                                  ? "ELSE"
                                  : "ELSE IF"}
                              {branch.kind !== "else"
                                ? ` · ${branch.conditions?.length ?? 0} 条件`
                                : ""}
                            </span>
                          </span>
                          {selectedAtRuntime ? (
                            <Badge variant="secondary">已命中</Badge>
                          ) : currentRunStatus?.selectedBranch ? (
                            <Badge variant="outline">已跳过</Badge>
                          ) : (
                            <ChevronRight data-icon="inline-end" />
                          )}
                        </Button>
                      );
                    },
                  )}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto p-4 lg:p-5">
                <div className="mx-auto flex max-w-6xl flex-col gap-5">
                  <ConditionRunSummary status={currentRunStatus} />
                  {activePanel === "global" ? (
                    <GlobalConfig
                      condition={current}
                      readOnly={readOnly}
                      onChange={updateCurrent}
                    />
                  ) : (
                    <>
                      <FieldSet>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <FieldLegend>{branchLabel(currentBranch, activeBranch)}</FieldLegend>
                            <FieldDescription>
                              {currentBranch.kind === "else"
                                ? "前面的判断均未命中时执行。"
                                : "按当前分支的 AND / OR 组合判断；不支持嵌套逻辑组。"}
                            </FieldDescription>
                          </div>
                          {!readOnly && currentBranch.kind === "else_if" ? (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={activeBranch <= 1}
                                onClick={() => moveBranch(activeBranch, -1)}
                                aria-label="上移分支"
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={activeBranch >= current.branches.length - 2}
                                onClick={() => moveBranch(activeBranch, 1)}
                                aria-label="下移分支"
                              >
                                <ArrowDown />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  currentBranch.steps.length > 0
                                    ? setDeleteRequest({ kind: "branch", index: activeBranch })
                                    : deleteBranch(activeBranch)
                                }
                                aria-label="删除分支"
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <Field>
                          <FieldLabel htmlFor="branch-name">分支名称</FieldLabel>
                          <Input
                            id="branch-name"
                            value={currentBranch.name ?? ""}
                            maxLength={80}
                            disabled={readOnly}
                            onChange={(event) =>
                              updateBranch({ ...currentBranch, name: event.target.value })
                            }
                            placeholder={currentBranch.kind === "else" ? "否则" : "例如：余额充足"}
                          />
                        </Field>
                        {currentBranch.kind !== "else" ? (
                          <FieldGroup>
                            <Field>
                              <FieldLabel>条件组合</FieldLabel>
                              <ToggleGroup
                                value={[currentBranch.logic ?? "and"]}
                                disabled={readOnly}
                                onValueChange={(values) =>
                                  values[0] &&
                                  updateBranch({
                                    ...currentBranch,
                                    logic: values[0] as "and" | "or",
                                  })
                                }
                              >
                                <ToggleGroupItem value="and">全部满足（AND）</ToggleGroupItem>
                                <ToggleGroupItem value="or">任一满足（OR）</ToggleGroupItem>
                              </ToggleGroup>
                            </Field>
                            <div className="grid gap-3">
                              {(currentBranch.conditions ?? []).map((rule, index) => (
                                <ConditionRuleCard
                                  key={`condition-${index}`}
                                  rule={rule}
                                  index={index}
                                  variables={variables}
                                  readOnly={readOnly}
                                  onChange={(next) =>
                                    updateBranch({
                                      ...currentBranch,
                                      conditions: (currentBranch.conditions ?? []).map(
                                        (item, itemIndex) => (itemIndex === index ? next : item),
                                      ),
                                    })
                                  }
                                  onDelete={() =>
                                    updateBranch({
                                      ...currentBranch,
                                      conditions: (currentBranch.conditions ?? []).filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    })
                                  }
                                />
                              ))}
                            </div>
                            {!readOnly ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  (currentBranch.conditions?.length ?? 0) >=
                                  CONDITION_LIMITS.conditionsPerBranch
                                }
                                onClick={() => {
                                  const variable = variables[0];
                                  updateBranch({
                                    ...currentBranch,
                                    conditions: [
                                      ...(currentBranch.conditions ?? []),
                                      createDefaultRule(
                                        variable?.name ?? "",
                                        variable?.valueType ?? "text",
                                      ),
                                    ],
                                  });
                                }}
                              >
                                <Plus data-icon="inline-start" />
                                添加条件
                              </Button>
                            ) : null}
                          </FieldGroup>
                        ) : null}
                      </FieldSet>

                      <Separator />

                      <FieldSet>
                        <FieldLegend>分支步骤</FieldLegend>
                        <FieldDescription>
                          此分支执行完会自动返回主流程；可继续添加普通节点或最多嵌套 3 层条件节点。
                        </FieldDescription>
                        {renderSequence({
                          steps: currentBranch.steps,
                          onChange: (steps) => updateBranch({ ...currentBranch, steps }),
                          onConditionSelect: (stepIndex) => {
                            setPath([...path, { branchIndex: activeBranch, stepIndex }]);
                            setActiveBranch(0);
                          },
                          readOnly,
                          run,
                          runLogs,
                          inheritedVariables: variables,
                          inheritedWait: currentHasWait,
                          pathPrefix: currentRuntimePath
                            ? `${currentRuntimePath}.branches[${activeBranch}].steps`
                            : undefined,
                        })}
                      </FieldSet>
                    </>
                  )}

                  {issues.length > 0 && !readOnly ? (
                    <Card size="sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle aria-hidden="true" />
                          还需完成 {issues.length} 项配置
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive">
                          {issues.slice(0, 8).map((issue) => (
                            <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </main>
            </div>
          ) : (
            <div className="grid min-h-0 place-items-center p-8 text-muted-foreground">
              无法读取条件节点配置。
            </div>
          )}

          <DialogFooter className="m-0 rounded-none px-4 py-3">
            <Button type="button" variant="outline" onClick={requestClose}>
              {readOnly ? "关闭" : "取消"}
            </Button>
            {!readOnly ? (
              <Button type="button" onClick={apply} disabled={!draft || issues.length > 0}>
                <CheckCircle2 data-icon="inline-start" />
                应用条件配置
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未应用的条件配置？</AlertDialogTitle>
            <AlertDialogDescription>
              条件工作区中的修改尚未应用到任务，关闭后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteRequest !== null}
        onOpenChange={(open) => !open && setDeleteRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除此分支及其中步骤？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会移除分支内全部节点。应用条件配置前仍可通过取消整个工作区放弃本次修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteRequest?.kind === "branch") deleteBranch(deleteRequest.index);
                setDeleteRequest(null);
              }}
            >
              删除分支
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
