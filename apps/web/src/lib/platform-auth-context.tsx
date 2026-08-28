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
import { platformApiFetch, platformTokenStorage } from "./platform-api-client";

export interface PlatformAdminDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface PlatformAuthContextValue {
  admin: PlatformAdminDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdminDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadAdmin = useCallback(async () => {
    const tokens = platformTokenStorage.get();
    if (!tokens) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const me = await platformApiFetch<PlatformAdminDto>("/api/platform/me");
      setAdmin(me);
    } catch {
      platformTokenStorage.clear();
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await platformApiFetch<{ accessToken: string; refreshToken: string }>(
        "/api/auth/platform-login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      platformTokenStorage.set(tokens.accessToken, tokens.refreshToken);
      await loadAdmin();
      router.push("/platform");
    },
    [loadAdmin, router],
  );

  const logout = useCallback(async () => {
    const tokens = platformTokenStorage.get();
    if (tokens) {
      await platformApiFetch("/api/auth/platform-logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => undefined);
    }
    platformTokenStorage.clear();
    setAdmin(null);
    router.push("/platform-login");
  }, [router]);

  return (
    <PlatformAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within a PlatformAuthProvider");
  return ctx;
}
