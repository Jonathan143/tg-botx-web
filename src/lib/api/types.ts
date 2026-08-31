import type { WorkflowStep } from "@/lib/workflow-condition";

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type HealthState = "healthy" | "degraded" | "unavailable" | "unknown";

export type DashboardResponse = {
  health: Record<string, HealthState | string>;
  stats: {
    totalTasks: number;
    enabledTasks: number;
    runningTasks: number;
    failedRuns: number;
    successRate: number;
  };
  statusBreakdown: Array<{ label: string; success: number; failed: number }>;
  recentRuns: TaskRun[];
  upcomingTasks: UpcomingTask[];
  accountStatus: Array<{ status: string; label: string; count: number }>;
};

export type UpcomingTask = {
  id: string;
  name: string;
  account: string;
  target: string;
  timezone: string;
  nextRunAt: string | null;
};

export type ScheduleDefinition = {
  type: "fixed" | "random";
  timezone: string;
  time?: string;
  start?: string;
  end?: string;
};

export type TaskDefinition = {
  name: string;
  account: string;
  target: string;
  schedule: ScheduleDefinition;
  retry: { max_attempts: number; backoff_seconds: number[] };
  steps: WorkflowStep[];
  notifications: { failure: boolean; success: boolean };
  log_bot_response?: boolean | null;
  log_condition_values?: boolean | null;
  notify_bot_response?: boolean | null;
};

export type TaskStepStatus = {
  index?: number | null;
  nodeId?: string | null;
  stepPath?: string | null;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  error?: string | null;
  botResponse?: string | null;
  /** Telegram inline/reply keyboard labels, grouped by their original rows. */
  botButtons?: string[][] | null;
  /** Elapsed execution time for the node, in milliseconds. */
  durationMs?: number | null;
  selectedBranch?: { index: number; kind: string; name?: string | null } | null;
  conditionVariables?: Array<{
    name: string;
    valueType: string;
    status: "success" | "failed";
    value?: string | null;
    error?: string | null;
  }> | null;
};

export type TaskRunProgress = {
  id: string;
  status: "running" | "success" | "failed" | "canceled" | "skipped";
  attempt: number;
  stepStatuses: TaskStepStatus[];
  error?: string | null;
  logs?: TaskRunLog[];
};

export type TaskRunLog = {
  timestamp: string | null;
  level: string | null;
  message: string;
  stepIndex?: number | null;
  nodeId?: string | null;
  stepPath?: string | null;
};

export type Task = {
  id: string;
  name: string;
  account: string;
  target: string;
  schedule: ScheduleDefinition;
  definition?: TaskDefinition;
  timezone?: string;
  enabled: boolean;
  archived: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  run?: TaskRunProgress | null;
  createdAt: string;
  updatedAt: string;
  latestWorkflowVersion?: number | null;
  workflowVersions?: WorkflowVersionSummary[];
};

export type WorkflowVersionSummary = {
  id: string;
  version: number;
  publishedAt: string;
  releaseNote: string | null;
};

export type TaskRun = {
  id: string;
  taskId: string;
  taskName?: string;
  account?: string;
  target?: string;
  status: string;
  plannedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  error: string | null;
  runKind?: "published" | "test" | string;
  workflowVersion?: number | "main" | string | null;
  workflowVersionId?: string | null;
  workflow?: (Partial<TaskDefinition> & { steps: WorkflowStep[] }) | null;
  workflowError?: string | null;
  progress?: TaskRunProgress | null;
};

export type Account = {
  id: string;
  name: string;
  phoneMasked?: string | null;
  active: boolean;
  isAuthorized?: boolean;
  createdAt: string;
  enabledTaskCount?: number;
  taskCount?: number;
};

export type AccountChat = {
  id: string;
  type: "bot" | "group" | "private";
  title: string;
  username: string | null;
  hasAvatar: boolean;
  avatarUrl: string | null;
};

export type MessageProbeButton = {
  row: number;
  column: number;
  text: string;
  callbackData: string | null;
};

export type MessageProbeResponse = {
  messageId: number;
  text: string;
  buttons: MessageProbeButton[];
};

export type LoginFlow = {
  flowId: string;
  accountName: string;
  method: "qr" | "phone";
  stage:
    | "connecting"
    | "phone_required"
    | "qr_pending"
    | "code_pending"
    | "password_pending"
    | "completed"
    | "failed";
  qrUrl?: string;
  qrExpiresAt?: string;
  message?: string;
};

export type LogEntry = {
  id?: string;
  timestamp: string | null;
  level: string | null;
  logger?: string;
  message: string;
  requestId?: string | null;
};

export type SettingsResponse = Record<string, string | number | boolean | null>;

export type BotBindingCode = {
  id: string;
  hint: string;
  status: "active" | "used" | "revoked" | "expired" | string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export type BotBinding = {
  id: string;
  userId: number;
  chatId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  boundAt: string;
};

export type BotBindingsResponse = {
  enabled: boolean;
  configured: boolean;
  status: {
    enabled: boolean;
    configured: boolean;
    running: boolean;
    health: string;
    lastPollAt: string | null;
    lastError: string | null;
  };
  codes: BotBindingCode[];
  bindings: BotBinding[];
};

export type BotCommand = {
  command: string;
  description: string;
  enabled: boolean;
  syncWarning?: string;
};

export type BotCommandsResponse = {
  commands: BotCommand[];
};

export type SessionResponse = {
  authenticated: true;
  csrfToken: string;
  sessionExpiresAt: string;
};

export type TransportKey = {
  keyId: string;
  publicKey: string;
  nonce: string;
  expiresAt: string;
  algorithm: "RSA-OAEP-256";
};

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
  };
};
