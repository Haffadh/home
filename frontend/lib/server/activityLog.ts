/**
 * Activity log: persist to database.
 * Ported from backend/lib/activityLog.js (minus WebSocket broadcast).
 */

import { getDb } from "./db";

export async function logActivity(opts: {
  actor_role?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload_json?: unknown;
}) {
  try {
    const db = getDb();
    await db.from("activity_log").insert({
      actor_role: opts.actor_role ?? null,
      actor_name: opts.actor_name ?? null,
      action: String(opts.action ?? "").slice(0, 64),
      entity_type: String(opts.entity_type ?? "").slice(0, 64),
      entity_id: opts.entity_id != null ? String(opts.entity_id).slice(0, 128) : null,
      payload_json: opts.payload_json != null ? opts.payload_json : null,
    });
  } catch (e) {
    console.error("activity_log insert failed:", e);
  }
}
