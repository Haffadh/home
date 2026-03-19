/**
 * Scene CRUD and execution. Scenes have actions: device_command, task_create, music_mode, notification.
 * Execution runs actions sequentially. device_command uses deviceService (Tuya).
 */

import * as deviceService from "./deviceService.js";

const ACTION_TYPES = ["device_command", "task_create", "music_mode", "notification"];

/**
 * @param {import("pg").Pool} db
 * @param {string} [id]
 * @returns {Promise<{ id: string; name: string; icon: string; description: string; actions: object[]; schedule: object | null }[]>}
 */
export async function getScenes(db, id) {
  let query = "SELECT id, name, icon, description, actions, schedule FROM scenes ORDER BY name ASC";
  const params = [];
  if (id) {
    query = "SELECT id, name, icon, description, actions, schedule FROM scenes WHERE id = $1";
    params.push(id);
  }
  const { rows } = await db.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon ?? "✨",
    description: r.description ?? "",
    actions: Array.isArray(r.actions) ? r.actions : [],
    schedule: r.schedule != null && typeof r.schedule === "object" ? r.schedule : null,
  }));
}

/**
 * Returns scenes that have an enabled time-based schedule (for scheduler loop).
 * Schedule shape: { enabled, time "HH:mm", daysOfWeek ["mon","tue",...] }.
 * Future: type "sunset" | "sunrise" | "location" can be added alongside "time".
 * @param {import("pg").Pool} db
 * @returns {Promise<{ id: string; name: string; schedule: object }[]>}
 */
export async function getScenesWithSchedules(db) {
  const scenes = await getScenes(db);
  return scenes.filter((s) => {
    const sch = s.schedule;
    if (!sch || sch.enabled !== true) return false;
    const time = sch.time;
    const days = sch.daysOfWeek;
    if (typeof time !== "string" || !/^\d{1,2}:\d{2}$/.test(time.trim())) return false;
    if (!Array.isArray(days) || days.length === 0) return false;
    return true;
  });
}

/**
 * @param {import("pg").Pool} db
 * @param {string} sceneId
 * @param {{ createUrgentTask: (opts: { title: string; assigned_to?: number }) => Promise<unknown>; logActivity: (opts: object) => Promise<void>; getActor: (req: object) => object }} deps
 * @param {object} request - for getActor
 * @param {(event: string, payload?: object) => void} broadcast
 * @returns {Promise<{ ok: boolean; message: string; results: object[] }>}
 */
export async function runScene(db, sceneId, deps, request, broadcast) {
  const scenes = await getScenes(db, sceneId);
  const scene = scenes[0];
  if (!scene) throw new Error("Scene not found");

  const results = [];
  const deviceIdsAll = await getDeviceIdsForAll();

  for (let i = 0; i < scene.actions.length; i++) {
    const action = scene.actions[i];
    const type = action?.type;
    try {
      if (type === "device_command") {
        const deviceIds = resolveDeviceIds(action.deviceId, deviceIdsAll);
        const command = action.command || {};
        for (const deviceId of deviceIds) {
          try {
            await deviceService.setDeviceState(deviceId, command);
            results.push({ index: i, type: "device_command", deviceId, ok: true });
          } catch (e) {
            results.push({ index: i, type: "device_command", deviceId, ok: false, error: e?.message });
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
        const mode = action.mode === "on" ? "on" : action.mode === "off" ? "off" : "stop";
        broadcast("music_mode", { mode });
        results.push({ index: i, type: "music_mode", mode, ok: true });
      } else if (type === "notification") {
        // Stub: no backend notification API; log only
        results.push({ index: i, type: "notification", ok: true, stub: true });
      } else {
        results.push({ index: i, type: type || "unknown", ok: false, error: "Unknown action type" });
      }
    } catch (e) {
      results.push({ index: i, type: type || "unknown", ok: false, error: e?.message });
    }
  }

  const actor = deps.getActor(request);
  await deps.logActivity({
    ...actor,
    action: "scene_run",
    entity_type: "scene",
    entity_id: sceneId,
    payload_json: { results },
  });

  return {
    ok: true,
    message: `${scene.name} scene activated`,
    results,
  };
}

async function getDeviceIdsForAll() {
  const devices = await deviceService.getDevices(true);
  return devices.map((d) => d.id).filter(Boolean);
}

function resolveDeviceIds(deviceId, allIds) {
  if (deviceId === "ALL" || deviceId === "" || deviceId == null) return allIds;
  return [String(deviceId)];
}

/**
 * @param {import("pg").Pool} db
 * @param {{ name: string; icon?: string; description?: string; actions?: object[] }} scene
 * @returns {Promise<{ id: string; name: string; icon: string; description: string; actions: object[] }>}
 */
export async function createScene(db, scene) {
  const name = String(scene.name || "").trim();
  if (!name) throw new Error("name required");
  const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const icon = String(scene.icon ?? "✨").trim() || "✨";
  const description = String(scene.description ?? "").trim();
  const actions = Array.isArray(scene.actions) ? scene.actions : [];
  const schedule = scene.schedule != null ? JSON.stringify(scene.schedule) : null;
  await db.query(
    "INSERT INTO scenes (id, name, icon, description, actions, schedule) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, name, icon, description, JSON.stringify(actions), schedule]
  );
  const [created] = await getScenes(db, id);
  return created;
}

/**
 * @param {import("pg").Pool} db
 * @param {string} id
 * @param {{ name?: string; icon?: string; description?: string; actions?: object[]; schedule?: object | null }} updates
 */
export async function updateScene(db, id, updates) {
  const fields = [];
  const values = [];
  let i = 1;
  if (updates.name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(String(updates.name).trim());
  }
  if (updates.icon !== undefined) {
    fields.push(`icon = $${i++}`);
    values.push(String(updates.icon).trim() || "✨");
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(String(updates.description).trim());
  }
  if (updates.actions !== undefined) {
    fields.push(`actions = $${i++}`);
    values.push(JSON.stringify(Array.isArray(updates.actions) ? updates.actions : []));
  }
  if (updates.schedule !== undefined) {
    fields.push(`schedule = $${i++}`);
    values.push(updates.schedule == null ? null : JSON.stringify(updates.schedule));
  }
  if (fields.length === 0) throw new Error("No updates");
  values.push(id);
  const { rowCount } = await db.query(
    `UPDATE scenes SET ${fields.join(", ")} WHERE id = $${i}`,
    values
  );
  if (rowCount === 0) throw new Error("Scene not found");
  const [updated] = await getScenes(db, id);
  return updated;
}

/**
 * @param {import("pg").Pool} db
 * @param {string} id
 */
export async function deleteScene(db, id) {
  const { rowCount } = await db.query("DELETE FROM scenes WHERE id = $1", [id]);
  if (rowCount === 0) throw new Error("Scene not found");
}

/**
 * Ensure scenes table exists and seed default scenes if empty.
 * @param {import("pg").Pool} db
 */
export async function ensureScenesTableAndSeed(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '✨',
      description TEXT DEFAULT '',
      actions JSONB DEFAULT '[]',
      schedule JSONB DEFAULT NULL
    )
  `);
  await db.query(`
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL
  `).catch(() => {});
  const { rows } = await db.query("SELECT id FROM scenes LIMIT 1");
  if (rows.length > 0) return;

  const defaults = [
    {
      id: "good_night",
      name: "Good Night",
      icon: "🌙",
      description: "Lights off • Blinds close • AC 23° • Music off",
      actions: [
        { type: "device_command", deviceId: "ALL", command: { switch: false } },
        { type: "music_mode", mode: "stop" },
      ],
    },
    {
      id: "away",
      name: "Away",
      icon: "🚪",
      description: "Lights off • Secure",
      actions: [{ type: "device_command", deviceId: "ALL", command: { switch: false } }],
    },
    {
      id: "movie_mode",
      name: "Movie Mode",
      icon: "🎬",
      description: "Lights dim • AC comfortable",
      actions: [
        { type: "device_command", deviceId: "ALL", command: { switch: true, brightness: 30 } },
      ],
    },
    {
      id: "shower_mode",
      name: "Shower Mode",
      icon: "🚿",
      description: "Towel heaters ON",
      actions: [{ type: "device_command", deviceId: "ALL", command: { switch: true } }],
    },
  ];
  for (const s of defaults) {
    await db.query(
      "INSERT INTO scenes (id, name, icon, description, actions) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [s.id, s.name, s.icon, s.description, JSON.stringify(s.actions)]
    );
  }
}
