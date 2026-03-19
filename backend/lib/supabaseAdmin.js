/**
 * Optional Supabase admin client for server-side notification creation.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * If not set, getSupabaseAdmin() returns null and callers should skip Supabase operations.
 */

import { createClient } from "@supabase/supabase-js";

let client = null;

export function getSupabaseAdmin() {
  if (client !== null) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    client = createClient(url, key, { auth: { persistSession: false } });
  } catch (e) {
    console.warn("Supabase admin init failed:", e?.message);
  }
  return client;
}

export async function hasUnreadNotificationByEntityId(entityId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("read", false)
    .eq("entity_id", entityId)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function createDeviceHealthNotification({ title, body, entity_type, entity_id }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      type: "device_health",
      title,
      body,
      read: false,
      entity_type: entity_type ?? "device",
      entity_id: entity_id ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn("createDeviceHealthNotification error:", error.message);
    return null;
  }
  return data;
}
