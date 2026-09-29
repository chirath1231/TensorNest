"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { clearTokens, getAccessToken, setTokens } from "./auth";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  /** Adopt a user the server just returned, so an edit shows in the header
   *  immediately rather than after the next full page load. */
  applyUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiFetch<TokenResponse>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        { skipAuth: true }
      );
      setTokens(tokens.access_token, tokens.refresh_token);
      await loadUser();
    },
    [loadUser]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const tokens = await apiFetch<TokenResponse>(
        "/auth/register",
        { method: "POST", body: JSON.stringify({ email, password, name }) },
        { skipAuth: true }
      );
      setTokens(tokens.access_token, tokens.refresh_token);
      await loadUser();
    },
    [loadUser]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const applyUser = useCallback((next: User) => setUser(next), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, applyUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
