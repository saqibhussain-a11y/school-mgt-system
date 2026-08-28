import { API_URL, ApiError } from "./api-client";

const ACCESS_TOKEN_KEY = "sms_platform_access_token";
const REFRESH_TOKEN_KEY = "sms_platform_refresh_token";

export const platformTokenStorage = {
  get() {
    if (typeof window === "undefined") return null;
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },
  set(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

async function refreshAccessToken(): Promise<string | null> {
  const tokens = platformTokenStorage.get();
  if (!tokens) return null;

  const res = await fetch(`${API_URL}/api/auth/platform-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  platformTokenStorage.set(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

export async function platformApiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = platformTokenStorage.get();

  const doFetch = (accessToken?: string) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch(tokens?.accessToken);

  if (res.status === 401 && tokens) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      res = await doFetch(newAccessToken);
    } else {
      platformTokenStorage.clear();
    }
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "Request failed");
  }
  return body as T;
}
