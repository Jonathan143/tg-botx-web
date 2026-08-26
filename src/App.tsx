import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Spinner } from "@/components/ui/spinner";

const UnlockPage = lazy(() => import("@/pages/unlock"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const NewTaskPage = lazy(() => import("@/pages/tasks/new"));
const TaskDetailPage = lazy(() => import("@/pages/tasks/detail"));
const RunsPage = lazy(() => import("@/pages/runs"));
const RunDetailPage = lazy(() => import("@/pages/runs/detail"));
const AccountsPage = lazy(() => import("@/pages/accounts"));
const LogsPage = lazy(() => import("@/pages/logs"));
const SettingsPage = lazy(() => import("@/pages/settings"));

function RouteLoader() {
  return (
    <div
      className="flex min-h-64 items-center justify-center"
      role="status"
      aria-label="正在加载页面"
    >
      <Spinner />
    </div>
  );
}

function ProtectedLayout() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "loading") return <RouteLoader />;
  if (auth.status !== "authenticated")
    return (
      <Navigate to="/unlock" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  return <AppShell />;
}

export function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/unlock" element={<UnlockPage />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/new" element={<NewTaskPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
