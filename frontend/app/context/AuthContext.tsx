"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiBase } from "../../lib/api";
import { getSupabaseClient } from "../../lib/supabaseClient";

const AUTH_TOKEN_KEY = "smarthub_token";

type AuthUser = { id: string; role: string };

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  sessionReady: boolean;
};

type AuthContextValue = AuthState & {
  login: (token: string) => void;
  logout: () => void;
  role: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem("token");
    }
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    }
    setToken(newToken);
    getApiBase("/auth/me", { cache: "no-store" })
      .then((data) => setUser({ id: String((data as { id?: string }).id), role: String((data as { role?: string }).role ?? "") }))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    getApiBase("/auth/me", { cache: "no-store" })
      .then((data) => {
        const d = data as { id?: string; role?: string };
        setUser({ id: String(d.id), role: String(d.role ?? "") });
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // When Supabase session is restored (or confirmed absent), allow API calls to run.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    supabase.auth.getSession().then(() => setSessionReady(true));
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    sessionReady,
    login,
    logout,
    role: user?.role ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
