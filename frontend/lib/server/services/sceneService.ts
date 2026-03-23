/**
 * Scene CRUD and execution.
 * Ported from backend/services/sceneService.js.
 */

import { getDb } from "../db";
import * as deviceService from "./deviceService";

export type Scene = {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: Record<string, unknown>[];
  schedule: Record<string, unknown> | null;
};

export async function getScenes(id?: string): Promise<Scene[]> {
  const db = getDb();
  let query = db.from("scenes").select("id, name, icon, description, actions, schedule").order("name");
  if (id) query = db.from("scenes").select("id, name, icon, description, actions, schedule").eq("id", id);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    icon: (r.icon as string) ?? "✨",
    description: (r.description as string) ?? "",
    actions: Array.isArray(r.actions) ? r.actions : [],
    schedule: r.schedule != null && typeof r.schedule === "object" ? r.schedule as Record<string, unknown> : null,
  }));
}

export async function runScene(
  sceneId: string,
  deps: {
    createUrgentTask: (opts: { title: string; assigned_to?: number | null }) => Promise<unknown>;
    logActivity: (opts: Record<string, unknown>) => Promise<void>;
    getActor: () => { actor_role: string | null; actor_name: string | null };
  }
): Promise<{ ok: boolean; message: string; results: Record<string, unknown>[] }> {
  const scenes = await getScenes(sceneId);
  const scene = scenes[0];
  if (!scene) throw new Error("Scene not found");

  const results: Record<string, unknown>[] = [];
  let allDeviceIds: string[] = [];
  try {
    const devices = await deviceService.getDevices(true);
    allDeviceIds = devices.map((d) => d.id).filter(Boolean);
  } catch { /* no HA */ }

  for (let i = 0; i < scene.actions.length; i++) {
    const action = scene.actions[i] as Record<string, unknown>;
    const type = action?.type;
    try {
      if (type === "device_command") {
        const deviceIds = resolveDeviceIds(action.deviceId as string, allDeviceIds);
        const command = (action.command || {}) as Record<string, unknown>;
        for (const deviceId of deviceIds) {
          try {
            await deviceService.setDeviceState(deviceId, command);
            results.push({ index: i, type: "device_command", deviceId, ok: true });
          } catch (e) {
            results.push({ index: i, type: "device_command", deviceId, ok: false, error: (e as Error)?.message });
          }
        }
      } else if (type === "task_create") {
        const title = typeof action.title === "string" ? action.title.trim() : "";
        if (title) {
          const assigned = typeof action.assigned_to === "number" ? action.assigned_to : null;
          await deps.createUrgentTask({ title, assigned_to: assigned });
          results.push({ index: i, type: "task_create", title, ok: true });
        }
      } else if (type === "music_mode") {
        results.push({ index: i, type: "music_mode", mode: action.mode, ok: true });
      } else if (type === "notification") {
        results.push({ index: i, type: "notification", ok: true, stub: true });
      } else {
        results.push({ index: i, type: type || "unknown", ok: false, error: "Unknown action type" });
      }
    } catch (e) {
      results.push({ index: i, type: type || "unknown", ok: false, error: (e as Error)?.message });
    }
  }

  const actor = deps.getActor();
  await deps.logActivity({
    ...actor,
    action: "scene_run",
    entity_type: "scene",
    entity_id: sceneId,
    payload_json: { results },
  });

  return { ok: true, message: `${scene.name} scene activated`, results };
}

function resolveDeviceIds(deviceId: string | undefined | null, allIds: string[]): string[] {
  if (deviceId === "ALL" || deviceId === "" || deviceId == null) return allIds;
  return [String(deviceId)];
}

export async function createScene(scene: {
  name?: string;
  icon?: string;
  description?: string;
  actions?: unknown[];
  schedule?: unknown;
}): Promise<Scene> {
  const name = String(scene.name || "").trim();
  if (!name) throw new Error("name required");
  const db = getDb();
  const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const icon = String(scene.icon ?? "✨").trim() || "✨";
  const description = String(scene.description ?? "").trim();
  const actions = Array.isArray(scene.actions) ? scene.actions : [];
  const schedule = scene.schedule != null ? scene.schedule : null;

  const { error } = await db.from("scenes").insert({
    id, name, icon, description,
    actions,
    schedule,
  });
  if (error) throw error;
  const [created] = await getScenes(id);
  return created;
}

export async function updateScene(id: string, updates: Record<string, unknown>): Promise<Scene> {
  const db = getDb();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = String(updates.name).trim();
  if (updates.icon !== undefined) patch.icon = String(updates.icon).trim() || "✨";
  if (updates.description !== undefined) patch.description = String(updates.description).trim();
  if (updates.actions !== undefined) patch.actions = Array.isArray(updates.actions) ? updates.actions : [];
  if (updates.schedule !== undefined) patch.schedule = updates.schedule == null ? null : updates.schedule;

  if (Object.keys(patch).length === 0) throw new Error("No updates");
  const { error, count } = await db.from("scenes").update(patch).eq("id", id);
  if (error) throw error;
  if (count === 0) throw new Error("Scene not found");
  const [updated] = await getScenes(id);
  return updated;
}

export async function deleteScene(id: string): Promise<void> {
  const db = getDb();
  const { error, count } = await db.from("scenes").delete().eq("id", id);
  if (error) throw error;
  if (count === 0) throw new Error("Scene not found");
}
