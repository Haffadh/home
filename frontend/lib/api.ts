/**
 * API base URL and request helper. getApiBase(path) performs the request and returns parsed JSON.
 * All backend API calls use the Supabase access token for Authorization when available.
 */

import { getSupabaseClient } from "./supabaseClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "";

const STORAGE_KEY_ROLE = "shh_role";
const STORAGE_KEY_ACTOR_NAME = "shh_actor_name";

export function getBaseUrl(): string {
  return API_BASE;
}

export type GetApiBaseOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
};

const AUTH_TOKEN_KEY_LEGACY = "smarthub_token";

/**
 * Resolves the auth token: Supabase session first, then localStorage "token", then "smarthub_token".
 * Ensures backend API (requireAuth) receives a valid Bearer token.
 */
async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) return token;
  }
  return localStorage.getItem("token") ?? localStorage.getItem(AUTH_TOKEN_KEY_LEGACY);
}

/**
 * Shared fetch for backend API. Automatically adds:
 * - Base URL (API_BASE + path)
 * - Content-Type: application/json
 * - Authorization: Bearer <Supabase access_token or localStorage token>
 * Preserves method, body, and other RequestInit options.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(typeof options.headers === "object" && options.headers !== null
      ? (options.headers as Record<string, string>)
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Main API request helper. Performs fetch to API_BASE + path and returns parsed JSON.
 * Uses apiFetch so all requests include the Supabase access token (or smarthub_token).
 * Backend routes use /api/* prefix (e.g. getApiBase("/api/devices")). Auth uses /auth/me.
 * Throws on !res.ok. For GET use getApiBase("/api/...") or getApiBase("/api/...", { cache: "no-store" }).
 * For mutations use getApiBase("/api/...", { method: "PATCH", body: {...} }).
 */
export async function getApiBase(path: string, options?: GetApiBaseOptions): Promise<unknown> {
  const method = options?.method ?? "GET";
  const init: RequestInit = {
    method,
    ...(options?.cache !== undefined ? { cache: options.cache } : {}),
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  };
  const actorHeaders = method !== "GET" ? getActorHeaders() : {};
  const res = await apiFetch(path, {
    ...init,
    headers: { ...actorHeaders },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `Request failed ${res.status}`);
  return data;
}

export function getActorMeta(): { actorRole: string; actorName: string } {
  if (typeof window === "undefined") return { actorRole: "", actorName: "" };
  const role = localStorage.getItem(STORAGE_KEY_ROLE) || "";
  const name = localStorage.getItem(STORAGE_KEY_ACTOR_NAME) || role || "—";
  return { actorRole: role, actorName: name };
}

/** Headers to send with mutation requests for activity log */
export function getActorHeaders(): Record<string, string> {
  const { actorRole, actorName } = getActorMeta();
  const h: Record<string, string> = {};
  if (actorRole) h["X-Actor-Role"] = actorRole;
  if (actorName) h["X-Actor-Name"] = actorName;
  return h;
}

/** Merge actor into JSON body for POST/PATCH */
export function withActorBody<T extends Record<string, unknown>>(body: T): T {
  const { actorRole, actorName } = getActorMeta();
  return { ...body, ...(actorRole && { actorRole }), ...(actorName && { actorName }) };
}

