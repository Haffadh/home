/**
 * Server-side Supabase client for API routes.
 * Uses service role key (bypasses RLS) to match the original Fastify backend behavior.
 * Falls back to direct pg-style query interface via Supabase's rpc/rest.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Helper: run a raw SQL query via Supabase's rpc.
 * For simple queries, prefer using the Supabase query builder (getDb().from(...)).
 * This is for complex queries that don't map well to the builder.
 */
export async function sql(query: string, params: unknown[] = []) {
  const db = getDb();
  const { data, error } = await db.rpc("exec_sql", {
    query,
    params,
  });
  if (error) throw error;
  return data;
}
