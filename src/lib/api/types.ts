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
  retry: { maxAttempts: number; backoffSeconds: number[] };
  steps: Array<Record<string, unknown>>;
  notifications: { failure: boolean; success: boolean };
  outputBotResponse?: boolean;
  logBotResponse?: boolean | null;
  notifyBotResponse?: boolean | null;
};

export type TaskStepStatus = {
  index: number;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  error?: string | null;
};

export type TaskRunProgress = {
  id: string;
  status: "running" | "success" | "failed" | "canceled" | "skipped";
  attempt: number;
  stepStatuses: TaskStepStatus[];
  error?: string | null;
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
