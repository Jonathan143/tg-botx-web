import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { apiRequest, jsonBody, onAuthRequired, setCsrfToken } from "@/lib/api/client";
import { encryptSensitiveValue } from "@/lib/api/crypto";
import type { SessionResponse } from "@/lib/api/types";

const sessionQueryKey = ["auth", "session"] as const;

type AuthContextValue = {
  status: "loading" | "authenticated" | "unauthenticated";
  sessionExpiresAt: string | null;
  unlock: (secret: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [forcedUnauthenticated, setForcedUnauthenticated] = React.useState(false);
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiRequest<SessionResponse>("/api/auth/session"),
    retry: false,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (sessionQuery.data?.csrfToken) {
      setCsrfToken(sessionQuery.data.csrfToken);
    }
  }, [sessionQuery.data]);

  React.useEffect(
    () =>
      onAuthRequired(() => {
        // Keep an explicit unauthenticated value so placeholderData cannot
        // resurrect the previous authenticated session while routing to /unlock.
        setForcedUnauthenticated(true);
        queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null);
      }),
    [queryClient],
  );

  const unlock = React.useCallback(
    async (secret: string) => {
      const encrypted = await encryptSensitiveValue("admin", secret);
      const session = await apiRequest<SessionResponse>("/api/auth/verify", {
        method: "POST",
        body: jsonBody(encrypted),
      });
      setForcedUnauthenticated(false);
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(sessionQueryKey, session);
    },
    [queryClient],
  );

  const logout = React.useCallback(async () => {
    await apiRequest<void>("/api/auth/logout", { method: "POST", body: jsonBody({}) });
    setForcedUnauthenticated(true);
    setCsrfToken(null);
    // Cancel in-flight requests before clearing their cached data. Otherwise
    // a late session response can restore authenticated state after logout.
    await queryClient.cancelQueries();
    // Keep the active session query mounted so its observer receives the
    // unauthenticated update. Clearing the whole cache would destroy that
    // observer and leave the provider rendering its previous result.
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
    });
    // Seed the session observer with a fresh unauthenticated value. This also
    // prevents keepPreviousData from restoring the previous authenticated one.
    queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null);
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status: forcedUnauthenticated
        ? "unauthenticated"
        : sessionQuery.isPending
          ? "loading"
          : sessionQuery.data?.authenticated
            ? "authenticated"
            : "unauthenticated",
      sessionExpiresAt: sessionQuery.data?.sessionExpiresAt ?? null,
      unlock,
      logout,
    }),
    [forcedUnauthenticated, sessionQuery.data, sessionQuery.isPending, unlock, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
}
