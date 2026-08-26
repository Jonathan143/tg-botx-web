import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { apiRequest, jsonBody, onAuthRequired, setCsrfToken } from "@/lib/api/client";
import { encryptSensitiveValue } from "@/lib/api/crypto";
import type { SessionResponse } from "@/lib/api/types";

type AuthContextValue = {
  status: "loading" | "authenticated" | "unauthenticated";
  sessionExpiresAt: string | null;
  unlock: (secret: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
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
        queryClient.setQueryData(["auth", "session"], undefined);
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
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(["auth", "session"], session);
    },
    [queryClient],
  );

  const logout = React.useCallback(async () => {
    await apiRequest<void>("/api/auth/logout", { method: "POST", body: jsonBody({}) });
    setCsrfToken(null);
    queryClient.clear();
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status: sessionQuery.isPending
        ? "loading"
        : sessionQuery.data?.authenticated
          ? "authenticated"
          : "unauthenticated",
      sessionExpiresAt: sessionQuery.data?.sessionExpiresAt ?? null,
      unlock,
      logout,
    }),
    [sessionQuery.data, sessionQuery.isPending, unlock, logout],
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
