import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Turn a FastAPI error body into one readable sentence.
 *
 *  FastAPI answers a 422 with `detail` as an *array* of per-field objects
 *  ({loc, msg, type}), not a string. Passing that straight to ApiError renders
 *  as "[object Object]" in the UI, so validation failures have to be flattened
 *  into "Field: message" before they reach a user. */
export function extractDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const detail = (body as { detail?: unknown }).detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const { loc, msg } = item as { loc?: unknown[]; msg?: string };
        if (!msg) return null;
        // loc looks like ["body", "password"]; the last entry names the field.
        const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined;
        return typeof field === "string" && field !== "body"
          ? `${field[0].toUpperCase()}${field.slice(1)}: ${msg}`
          : msg;
      })
      .filter((x): x is string => Boolean(x));
    if (parts.length) return parts.join(". ");
  }

  return fallback;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  { skipAuth = false }: { skipAuth?: boolean } = {}
): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && options.body) {
      headers.set("Content-Type", "application/json");
    }
    if (!skipAuth) {
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  };

  let response = await doFetch();

  if (response.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await doFetch();
    } else {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = extractDetail(await response.json(), detail);
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
