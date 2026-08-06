"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { MeDto } from "@sms/shared-types";
import { apiFetch, tokenStorage } from "./api-client";

interface AuthContextValue {
  user: MeDto | null;
  loading: boolean;
  login: (schoolId: string, email: string, password: string) => Promise<void>;
  platformLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const tokens = tokenStorage.get();
    if (!tokens) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<MeDto>("/api/me");
      setUser(me);
    } catch {
      tokenStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (schoolId: string, email: string, password: string) => {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ schoolId, email, password }) },
      );
      tokenStorage.set(tokens.accessToken, tokens.refreshToken, schoolId);
      await loadUser();
      router.push("/dashboard");
    },
    [loadUser, router],
  );

  const platformLogin = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string; schoolId: string }>(
        "/api/auth/platform-login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      tokenStorage.set(tokens.accessToken, tokens.refreshToken, tokens.schoolId);
      await loadUser();
      router.push("/dashboard");
    },
    [loadUser, router],
  );

  const logout = useCallback(async () => {
    const tokens = tokenStorage.get();
    if (tokens) {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => undefined);
    }
    tokenStorage.clear();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, platformLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
