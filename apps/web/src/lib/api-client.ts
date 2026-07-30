const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "sms_access_token";
const REFRESH_TOKEN_KEY = "sms_refresh_token";
const SCHOOL_ID_KEY = "sms_school_id";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStorage = {
  get() {
    if (typeof window === "undefined") return null;
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const schoolId = localStorage.getItem(SCHOOL_ID_KEY);
    if (!accessToken || !refreshToken || !schoolId) return null;
    return { accessToken, refreshToken, schoolId };
  },
  set(accessToken: string, refreshToken: string, schoolId: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(SCHOOL_ID_KEY, schoolId);
  },
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SCHOOL_ID_KEY);
  },
};

async function refreshAccessToken(): Promise<string | null> {
  const tokens = tokenStorage.get();
  if (!tokens) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const tokens = tokenStorage.get();
  const isFormData = options.body instanceof FormData;

  const doFetch = (accessToken?: string) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
      tokenStorage.clear();
    }
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "Request failed");
  }
  return body as T;
}

export { API_URL };
