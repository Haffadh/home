import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null | undefined = undefined;

/**
 * Lazy-initialized Supabase client. Created on first call so env is read at runtime
 * (avoids null client when module was first evaluated before env was available).
 */
function getClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Data features will be empty."
      );
    }
    _client = null;
    return _client;
  }
  _client = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}

/** Use this in components when you need to guard on client presence (e.g. if (!getSupabaseClient()) return). */
export function getSupabaseClient(): SupabaseClient | null {
  return getClient();
}

/**
 * Use this in services for queries. Throws if client is not configured.
 */
export function getSupabase(): SupabaseClient {
  const client = getClient();
  if (!client) {
    const msg = "Supabase client not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)";
    console.error("[supabase]", msg);
    throw new Error(msg);
  }
  return client;
}

