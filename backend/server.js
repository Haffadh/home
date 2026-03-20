import "dotenv/config";

import Fastify from "fastify";
import pg from "pg";
import cors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import * as deviceService from "./services/deviceService.js";
import { isConfigured as hassConfigured } from "./services/hassClient.js";
import * as sceneService from "./services/sceneService.js";
import * as sceneScheduler from "./services/sceneScheduler.js";
import * as mealAIService from "./services/mealAIService.js";
import { startDeviceHealthScheduler } from "./services/deviceHealthScheduler.js";
import { generateHowToAnswer } from "./openaiClient.js";
import * as dailyTasksDb from "./lib/dailyTasksDb.js";
import { getActor, logActivity, broadcast } from "./lib/activityLog.js";
import authRoutes from "./routes/auth.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import ROLES from "./constants/roles.js";

console.log("ENV loaded");
if (hassConfigured()) {
  console.log("Home Assistant configured ✅");
} else {
  console.log("Home Assistant not configured — device features disabled (set HASS_URL + HASS_TOKEN)");
}
// ---- Helpers ----

function safeErrorMessage(e) {
  if (e == null) return "Server error";
  const msg = e instanceof Error ? e.message : String(e);
  return (msg && msg.slice(0, 200)) || "Server error";
}

function sendError(reply, code, error) {
  return reply.code(code).send({ ok: false, error: String(error).slice(0, 200) });
}

const fastify = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 }); // 10MB for image uploads

fastify.addHook("onRequest", async (request) => {
  request.log.info({ method: request.method, url: request.url }, "route hit");
});

await fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
});
await fastify.register(fastifyWebsocket, {
  options: {
    verifyClient: (_info, next) => next(true),
  },
});

const db = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "nawaf",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "smarthub",
  port: Number(process.env.DB_PORT) || 5432,
});

try {
  await db.query("SELECT 1");
  console.log("Database connected ✅");
} catch (e) {
  console.error("Database connection failed:", e.message);
  process.exit(1);
}

// Activity log table
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      ts TIMESTAMP DEFAULT now(),
      actor_role TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload_json JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_ts ON activity_log(ts DESC);
  `);
} catch (e) { console.warn("activity_log init:", e.message); }

// Ensure core tables exist
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS urgent_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      assigned_to INTEGER,
      acknowledged BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      dish TEXT,
      drink TEXT,
      portions INTEGER DEFAULT 1,
      requested_by TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Food',
      quantity NUMERIC DEFAULT 1,
      expiration_date DATE,
      updated_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date DATE,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER DEFAULT 60,
      status TEXT DEFAULT 'pending',
      category TEXT,
      is_done BOOLEAN DEFAULT false,
      gathering_id TEXT,
      is_auto_generated BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
} catch (e) { console.warn("core tables init:", e.message); }

// Extend inventory schema
try {
  await db.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs'`);
  await db.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS threshold INTEGER DEFAULT 2`);
  await db.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location TEXT`);
  await db.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS default_location TEXT`);
  await db.query(`ALTER TABLE inventory ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC`);
  await db.query(`ALTER TABLE inventory ALTER COLUMN quantity SET DEFAULT 1`);
} catch (e) { console.warn("inventory schema extend:", e.message); }

// Register auth routes (public: /auth/register, /auth/login, /auth/refresh, /auth/logout; GET /auth/me requires auth)
await fastify.register(authRoutes, { db, requireAuth });

// Daily reset
let lastCleanupDay = new Date().toDateString();
setInterval(async () => {
  try {
    const now = new Date();
    const day = now.toDateString();
    if (day === lastCleanupDay) return;
    lastCleanupDay = day;
    await db.query("UPDATE tasks SET is_done = false WHERE is_done = true");
    await db.query("DELETE FROM urgent_tasks WHERE acknowledged = true");
    await db.query("DELETE FROM groceries WHERE is_done = true");
    console.log("Daily reset ran ✅");
  } catch (e) { console.error("Daily reset failed", e); }
}, 60_000);

async function findUserIdByName(name) {
  try {
    const { rows } = await db.query("SELECT id FROM users WHERE LOWER(name) = LOWER($1) ORDER BY id ASC LIMIT 1", [name]);
    return rows?.[0]?.id ?? null;
  } catch { return null; }
}

async function createUrgentTask({ title, assigned_to, priority, alert_on_free, submitted_by }) {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) throw new Error("title required");
  const assigned = typeof assigned_to === "number" && Number.isFinite(assigned_to) ? assigned_to : null;
  const prio = typeof priority === "number" ? Math.max(1, Math.min(3, priority)) : 1;
  const aof = Boolean(alert_on_free);
  const sub = typeof submitted_by === "string" ? submitted_by.trim() : null;
  const { rows } = await db.query(
    "INSERT INTO urgent_tasks (title, assigned_to, priority, alert_on_free, submitted_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [t, assigned, prio, aof, sub]
  );
  return rows[0];
}

// =============================================
// PUBLIC ROUTES
// =============================================

fastify.get("/", async () => ({ ok: true, status: "Smart Home Hub backend running" }));
fastify.get("/health", async () => ({ ok: true }));

fastify.get("/api/weather", async (request, reply) => {
  try {
    const lat = 26.2235, lon = 50.5876;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Weather failed (${res.status})`);
      const data = await res.json().catch(() => null);
      const tempC = Math.round(Number(data?.current?.temperature_2m));
      const code = Number(data?.current?.weather_code);
      let condition = "Clear", icon = "sun";
      if ([1, 2, 3].includes(code)) { condition = "Cloudy"; icon = "cloud"; }
      else if ([45, 48].includes(code)) { condition = "Fog"; icon = "cloud"; }
      else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) { condition = "Rain"; icon = "rain"; }
      return reply.send({ tempC, condition, icon, location: "Bahrain" });
    } finally { clearTimeout(t); }
  } catch (e) {
    return reply.send({ tempC: 24, condition: "Clear", icon: "sun", location: "Bahrain" });
  }
});

fastify.get("/api/env-status", async () => ({
  ok: true,
  hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  hasHass: hassConfigured(),
  hassUrl: process.env.HASS_URL || "",
}));

// WebSocket: real-time events (no auth for simplicity; origin verified in verifyClient)
fastify.get("/ws", { websocket: true }, (socket, req) => {
  socket.on("message", () => {});
  socket.on("close", () => {});
});

// =============================================
// PROTECTED ROUTES
// =============================================

fastify.get("/api/activity", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const limit = Math.min(Number(request.query?.limit) || 50, 100);
    const { rows } = await db.query(
      "SELECT id, ts, actor_role, actor_name, action, entity_type, entity_id, payload_json FROM activity_log ORDER BY ts DESC LIMIT $1",
      [limit]
    );
    return reply.send(rows);
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

// ---- Users ----
fastify.get("/api/users", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT id, name, role, created_at FROM users ORDER BY id");
    return reply.send(rows.length ? rows : [{ id: 1, name: "Admin", role: "admin", created_at: new Date().toISOString() }]);
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

fastify.post("/api/users", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, async (request) => {
  const { name, role } = request.body;
  const { rows } = await db.query("INSERT INTO users (name, role) VALUES ($1, $2) RETURNING *", [name, role]);
  return rows[0];
});

// ---- Today's Tasks (in-memory) ----
const TASK_TIME_WINDOWS = { morning: { start: "08:00", end: "12:00" }, afternoon: { start: "12:00", end: "17:00" }, evening: { start: "17:00", end: "22:00" } };
const taskStore = [];

function nextId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toNormalizedTask(raw) {
  if (raw.date && (raw.startTime || raw.scheduledTime)) {
    const start = raw.startTime || raw.scheduledTime;
    const end = raw.endTime || (raw.durationMinutes ? new Date(new Date(start).getTime() + raw.durationMinutes * 60 * 1000).toISOString() : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString());
    return { id: raw.id, title: raw.title, date: raw.date, startTime: typeof start === "string" ? start : new Date(start).toISOString(), endTime: typeof end === "string" ? end : new Date(end).toISOString(), durationMinutes: raw.durationMinutes ?? Math.round((new Date(end) - new Date(start)) / 60000), status: raw.status ?? (raw.completed ? "completed" : "pending"), category: raw.category ?? "general", gatheringId: raw.gatheringId ?? null, isAutoGenerated: Boolean(raw.isAutoGenerated) };
  }
  const scheduled = raw.scheduledTime || raw.startTime;
  if (!scheduled) return null;
  const d = new Date(scheduled);
  const dateStr = d.toISOString().slice(0, 10);
  const dur = raw.durationMinutes ?? 60;
  const endDate = new Date(d.getTime() + dur * 60 * 1000);
  return { id: raw.id, title: raw.title, date: dateStr, startTime: d.toISOString(), endTime: endDate.toISOString(), durationMinutes: dur, status: raw.status ?? (raw.completed ? "completed" : "pending"), category: raw.category ?? "general", gatheringId: raw.gatheringId ?? null, isAutoGenerated: Boolean(raw.isAutoGenerated) };
}

function getSlotBounds(dateStr, windowKey) {
  const w = TASK_TIME_WINDOWS[windowKey];
  if (!w) return null;
  const [sh, sm] = w.start.split(":").map(Number);
  const [eh, em] = w.end.split(":").map(Number);
  return { start: new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`), end: new Date(`${dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`) };
}

function findNextFreeSlot(taskStoreRef, dateStr, durationMinutes, excludeId) {
  const windows = ["morning", "afternoon", "evening"];
  const tasksOnDay = taskStoreRef.filter((t) => t.date === dateStr && t.status !== "completed" && t.id !== excludeId).map(toNormalizedTask).filter(Boolean);
  for (const w of windows) {
    const bounds = getSlotBounds(dateStr, w);
    if (!bounds) continue;
    let cursor = bounds.start.getTime();
    const endTs = bounds.end.getTime();
    while (cursor + durationMinutes * 60 * 1000 <= endTs) {
      const overlaps = tasksOnDay.some((t) => cursor < new Date(t.endTime).getTime() && (cursor + durationMinutes * 60 * 1000) > new Date(t.startTime).getTime());
      if (!overlaps) return { startTime: new Date(cursor).toISOString(), endTime: new Date(cursor + durationMinutes * 60 * 1000).toISOString(), date: dateStr };
      cursor += durationMinutes * 60 * 1000;
    }
  }
  return null;
}

function rescheduleMissedTasks(store) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  for (const t of store) {
    const norm = toNormalizedTask(t);
    if (!norm || norm.date !== today || norm.status === "completed") continue;
    if (now <= new Date(norm.endTime)) continue;
    const slot = findNextFreeSlot(store, today, norm.durationMinutes, t.id);
    if (slot) { t.startTime = slot.startTime; t.endTime = slot.endTime; t.date = slot.date; }
    else {
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextDate = tomorrow.toISOString().slice(0, 10);
      const ms = findNextFreeSlot(store, nextDate, norm.durationMinutes, t.id);
      if (ms) { t.startTime = ms.startTime; t.endTime = ms.endTime; t.date = ms.date; }
    }
  }
}

fastify.get("/api/tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  rescheduleMissedTasks(taskStore);
  const sorted = taskStore.map(toNormalizedTask).filter(Boolean).sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
  return reply.send({ ok: true, tasks: sorted });
});

fastify.post("/api/tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return sendError(reply, 400, "title required");
  let dateStr, startTime, endTime;
  let durationMinutes = body.durationMinutes != null ? Number(body.durationMinutes) : 60;
  const category = typeof body.category === "string" ? body.category : "general";
  const gatheringId = body.gatheringId ?? null;
  const isAutoGenerated = Boolean(body.isAutoGenerated);
  if (body.date && (body.startTime || body.timeWindow)) {
    dateStr = String(body.date).slice(0, 10);
    if (body.startTime) {
      const timeStr = body.startTime;
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(timeStr))) { startTime = `${dateStr}T${String(timeStr).length === 5 ? `${timeStr}:00` : timeStr}`; }
      else { startTime = new Date(body.startTime).toISOString(); }
      endTime = body.endTime || new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
    } else {
      // Smart scheduling: find next free slot in the requested window (or any window)
      const slot = findNextFreeSlot(taskStore, dateStr, durationMinutes);
      if (slot) {
        startTime = slot.startTime;
        endTime = slot.endTime;
      } else {
        // Fallback: use window start if no free slot
        const window = TASK_TIME_WINDOWS[body.timeWindow] || TASK_TIME_WINDOWS.morning;
        startTime = `${dateStr}T${window.start}:00`;
        endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
      }
    }
  } else {
    const scheduledTime = typeof body.scheduledTime === "string" ? body.scheduledTime.trim() : "";
    if (!scheduledTime || isNaN(new Date(scheduledTime).getTime())) return sendError(reply, 400, "scheduledTime or (date + startTime) required");
    const d = new Date(scheduledTime);
    dateStr = d.toISOString().slice(0, 10); startTime = d.toISOString();
    endTime = new Date(d.getTime() + durationMinutes * 60 * 1000).toISOString();
  }
  const task = { id: nextId(), title, date: dateStr, startTime, endTime, durationMinutes, status: "pending", category, gatheringId, isAutoGenerated };
  taskStore.push(task);
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "created", entity_type: "task", entity_id: task.id, payload_json: { title } });
  broadcast(fastify, "tasks_updated", {});
  return reply.code(201).send({ ok: true, task: toNormalizedTask(task) });
});

fastify.patch("/api/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  if (!id) return sendError(reply, 400, "id required");
  const task = taskStore.find((t) => t.id === id);
  if (!task) return sendError(reply, 404, "task not found");
  const body = request.body || {};
  if (typeof body.title === "string" && body.title.trim()) task.title = body.title.trim();
  if (body.date) task.date = String(body.date).slice(0, 10);
  if (body.startTime) task.startTime = body.startTime;
  if (body.endTime) task.endTime = body.endTime;
  if (body.durationMinutes != null || body.duration_minutes != null) task.durationMinutes = Number(body.durationMinutes ?? body.duration_minutes);
  if (typeof body.category === "string") task.category = body.category;
  if (body.timeWindow && TASK_TIME_WINDOWS[body.timeWindow]) {
    const bounds = getSlotBounds(task.date, body.timeWindow);
    if (bounds) { task.startTime = bounds.start.toISOString(); task.endTime = new Date(bounds.start.getTime() + (task.durationMinutes || 60) * 60 * 1000).toISOString(); }
  }
  if (body.status === "pending" || body.status === "completed") task.status = body.status;
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "updated", entity_type: "task", entity_id: id, payload_json: {} });
  broadcast(fastify, "tasks_updated", {});
  return reply.send({ ok: true, task: toNormalizedTask(task) });
});

fastify.patch("/api/tasks/:id/complete", { preHandler: [requireAuth] }, async (request, reply) => {
  const task = taskStore.find((t) => t.id === request.params?.id);
  if (!task) return sendError(reply, 404, "task not found");
  task.status = "completed";
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "toggled", entity_type: "task", entity_id: task.id, payload_json: { status: "completed" } });
  broadcast(fastify, "tasks_updated", {});
  // Check for waiting urgent tasks that should alert now
  try {
    const { rows: waiting } = await db.query("SELECT * FROM urgent_tasks WHERE alert_on_free = true AND acknowledged = false ORDER BY id ASC");
    for (const w of waiting) {
      await db.query("UPDATE urgent_tasks SET alert_on_free = false WHERE id = $1", [w.id]);
      broadcast(fastify, "urgent_alert", { id: w.id, title: w.title, submittedBy: w.submitted_by });
    }
  } catch { /* ignore */ }
  return reply.send({ ok: true, task: toNormalizedTask(task) });
});

fastify.delete("/api/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const idx = taskStore.findIndex((t) => t.id === request.params?.id);
  if (idx === -1) return sendError(reply, 404, "task not found");
  const id = request.params?.id;
  taskStore.splice(idx, 1);
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "deleted", entity_type: "task", entity_id: id, payload_json: {} });
  broadcast(fastify, "tasks_updated", {});
  return reply.send({ ok: true });
});

fastify.patch("/api/tasks/reorder", { preHandler: [requireAuth] }, async (request, reply) => {
  const items = Array.isArray(request.body?.tasks) ? request.body.tasks : Array.isArray(request.body) ? request.body : [];
  if (items.length === 0) return sendError(reply, 400, "tasks array required");
  for (const item of items) {
    const task = taskStore.find((t) => t.id === item.id);
    if (!task) continue;
    if (item.startTime) task.startTime = item.startTime;
    if (item.endTime) task.endTime = item.endTime;
  }
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "reordered", entity_type: "task", entity_id: null, payload_json: { count: items.length } });
  broadcast(fastify, "tasks_updated", {});
  return reply.send({ ok: true });
});

// ---- Gathering ----
const ROOM_PREP_45 = ["Mariam's Room", "Winklevoss' Room", "Master Bedroom", "Kitchen"];
const ROOM_PREP_60 = ["Dining Room", "TV Room", "Outdoor Seating Area"];
const DRIVEWAY_DURATION = 180;
const OTHER_TASKS = [
  { title: "Buy ingredients for cooking", category: "food", duration: 60 },
  { title: "Check toilet supplies", category: "supplies", duration: 15 },
  { title: "Buy plastic water bottles & soft drinks", category: "supplies", duration: 45 },
  { title: "Move buffet table to designated location", category: "prep", duration: 30 },
  { title: "Prepare nuts & snacks", category: "food", duration: 30 },
  { title: "Prepare tea", category: "hosting", duration: 20 },
  { title: "Prepare Arabic coffee", category: "hosting", duration: 20 },
];

function generateGatheringTasks(payload) {
  const { gatheringType, guestCount, date: eventDateStr, time: eventTimeStr, gatheringId } = payload;
  const eventDateOnly = eventDateStr.slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDay = new Date(eventDateOnly); eventDay.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((eventDay - today) / (24 * 60 * 60 * 1000));
  const isLunch = gatheringType === "lunch";
  const gateTask = { title: "Keep the gate open", category: "hosting", duration: 10, time: isLunch ? "14:00" : "19:00", date: eventDateOnly };
  const room45 = ROOM_PREP_45.map((title) => ({ title, duration: 45, category: "room" }));
  const room60 = ROOM_PREP_60.map((title) => ({ title, duration: 60, category: "room" }));
  const driveway = daysUntil >= 7 ? [{ title: "Driveway", category: "room", duration: DRIVEWAY_DURATION }] : [];
  const allRoom = [...room45, ...room60, ...driveway];
  const allOther = [...OTHER_TASKS, gateTask];
  const gid = gatheringId || nextId();
  const created = [];
  const windows = ["morning", "afternoon", "evening"];

  function placeTask(taskSpec, dateStr, windowKey) {
    const bounds = getSlotBounds(dateStr, windowKey);
    if (!bounds) return null;
    const dur = taskSpec.duration || 60;
    const existingOnDay = taskStore.filter((t) => t.date === dateStr).map(toNormalizedTask).filter(Boolean);
    let cursor = bounds.start.getTime();
    while (cursor + dur * 60 * 1000 <= bounds.end.getTime()) {
      const overlaps = existingOnDay.some((t) => cursor < new Date(t.endTime).getTime() && cursor + dur * 60 * 1000 > new Date(t.startTime).getTime());
      if (!overlaps) {
        const task = { id: nextId(), title: taskSpec.title, date: dateStr, startTime: new Date(cursor).toISOString(), endTime: new Date(cursor + dur * 60 * 1000).toISOString(), durationMinutes: dur, status: "pending", category: taskSpec.category || "prep", gatheringId: gid, isAutoGenerated: true };
        taskStore.push(task); created.push(toNormalizedTask(task)); existingOnDay.push(toNormalizedTask(task));
        return task;
      }
      cursor += dur * 60 * 1000;
    }
    return null;
  }

  function placeFixedTimeTask(t) {
    if (!t.dateOverride && !t.date) return;
    const d = t.dateOverride || t.date;
    const startIso = `${d}T${t.time}:00`;
    const endIso = new Date(new Date(startIso).getTime() + (t.duration || 10) * 60 * 1000).toISOString();
    const task = { id: nextId(), title: t.title, date: d, startTime: startIso, endTime: endIso, durationMinutes: t.duration || 10, status: "pending", category: t.category || "hosting", gatheringId: gid, isAutoGenerated: true };
    taskStore.push(task); created.push(toNormalizedTask(task));
  }

  const prepTasks = [...allRoom, ...allOther.filter((x) => !x.date && !x.dateOverride)];
  const fixedTasks = allOther.filter((x) => (x.date || x.dateOverride) && x.time);

  if (daysUntil <= 1) {
    const todayStr = today.toISOString().slice(0, 10);
    let wi = 0;
    for (const t of prepTasks) { placeTask(t, todayStr, windows[wi % 3]); wi++; }
  } else {
    const availableDays = [];
    for (let d = 1; d < daysUntil; d++) { const s = new Date(today); s.setDate(s.getDate() + d); availableDays.push(s.toISOString().slice(0, 10)); }
    let taskIdx = 0;
    outer: for (const dateStr of availableDays) {
      for (const w of windows) {
        while (taskIdx < prepTasks.length) { if (placeTask(prepTasks[taskIdx], dateStr, w)) { taskIdx++; continue; } break; }
        if (taskIdx >= prepTasks.length) break outer;
      }
    }
  }
  for (const t of fixedTasks) placeFixedTimeTask(t);

  return { gatheringId: gid, created };
}

fastify.post("/api/gathering/generate", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const body = request.body || {};
    const gatheringType = typeof body.gatheringType === "string" ? body.gatheringType : "";
    if (!["lunch", "dinner", "casual_evening", "other"].includes(gatheringType)) return sendError(reply, 400, "gatheringType must be one of: lunch, dinner, casual_evening, other");
    const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
    const time = typeof body.time === "string" ? body.time.trim().slice(0, 5) : "18:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendError(reply, 400, "date required (YYYY-MM-DD)");
    const result = generateGatheringTasks({ gatheringType, guestCount: parseInt(body.guestCount || 0) || 0, date, time });
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "created", entity_type: "task", entity_id: null, payload_json: { gatheringType, count: result.created?.length ?? 0 } });
    broadcast(fastify, "tasks_updated", {});
    return reply.send({ ok: true, ...result, tasks: result.created });
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

// ---- Groceries ----
async function ensureGroceriesTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS groceries (id SERIAL PRIMARY KEY, title TEXT NOT NULL, requested_by TEXT NOT NULL, is_done BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT now());`);
}
try { await ensureGroceriesTable(); } catch (e) { console.warn("DB init warning:", e.message || e); }
try { await sceneService.ensureScenesTableAndSeed(db); } catch (e) { console.warn("Scenes init warning:", e.message || e); }

fastify.get("/api/groceries", { preHandler: [requireAuth] }, async (request, reply) => {
  const { rows } = await db.query("SELECT * FROM groceries ORDER BY id DESC");
  return reply.send(rows);
});

fastify.post("/api/groceries", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const title = (body.name || body.title || "").trim();
  if (!title) return sendError(reply, 400, "Invalid name");
  const { rows } = await db.query("INSERT INTO groceries (title, requested_by) VALUES ($1, $2) RETURNING *", [title, body.requestedBy === "abood" ? "abood" : "family"]);
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "created", entity_type: "grocery", entity_id: String(rows[0]?.id), payload_json: { title } });
  broadcast(fastify, "groceries_updated", {});
  return reply.send(rows[0]);
});

fastify.patch("/api/groceries/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};
  const fields = [], values = [];
  let i = 1;
  if (typeof body.bought === "boolean") { fields.push(`is_done = $${i++}`); values.push(body.bought); }
  const name = (body.name || body.title || "").trim();
  if (name) { fields.push(`title = $${i++}`); values.push(name); }
  if (!fields.length) return sendError(reply, 400, "Invalid body");
  values.push(id);
  const { rows } = await db.query(`UPDATE groceries SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
  if (!rows[0]) return sendError(reply, 404, "Not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "updated", entity_type: "grocery", entity_id: id, payload_json: {} });
  broadcast(fastify, "groceries_updated", {});
  return reply.send(rows[0]);
});

fastify.delete("/api/groceries/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params.id;
  const result = await db.query("DELETE FROM groceries WHERE id = $1 RETURNING id", [id]);
  if (!result.rows.length) return sendError(reply, 404, "Not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "deleted", entity_type: "grocery", entity_id: id, payload_json: {} });
  broadcast(fastify, "groceries_updated", {});
  return reply.send({ ok: true });
});

// ---- Scenes (legacy trigger path: forward to new runner) ----
fastify.post("/api/scenes/:sceneId/trigger", { preHandler: [requireAuth] }, async (request, reply) => {
  const { sceneId } = request.params;
  try {
    const result = await sceneService.runScene(db, sceneId, {
      createUrgentTask,
      logActivity: (opts) => logActivity(db, opts),
      getActor: (req) => getActor(req),
    }, request, (event, payload) => broadcast(fastify, event, payload || {}));
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, sceneId, message: result.message, ...result });
  } catch (e) {
    return sendError(reply, 404, safeErrorMessage(e));
  }
});

// ---- API Scenes (CRUD + run) ----
fastify.get("/api/scenes", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const list = await sceneService.getScenes(db);
    return reply.send({ ok: true, scenes: list });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.post("/api/scenes/:id/run", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  if (!id) return sendError(reply, 400, "id required");
  try {
    const result = await sceneService.runScene(db, id, {
      createUrgentTask,
      logActivity: (opts) => logActivity(db, opts),
      getActor: (req) => getActor(req),
    }, request, (event, payload) => broadcast(fastify, event, payload || {}));
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, sceneId: id, message: result.message, ...result });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("not found")) return sendError(reply, 404, msg);
    return sendError(reply, 500, msg);
  }
});

fastify.post("/api/scenes", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  try {
    const scene = await sceneService.createScene(db, {
      name: body.name,
      icon: body.icon,
      description: body.description,
      actions: body.actions,
      schedule: body.schedule,
    });
    return reply.send({ ok: true, scene });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("required")) return sendError(reply, 400, msg);
    return sendError(reply, 500, msg);
  }
});

fastify.patch("/api/scenes/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const body = request.body || {};
  if (!id) return sendError(reply, 400, "id required");
  try {
    const scene = await sceneService.updateScene(db, id, {
      name: body.name,
      icon: body.icon,
      description: body.description,
      actions: body.actions,
      schedule: body.schedule,
    });
    return reply.send({ ok: true, scene });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("not found")) return sendError(reply, 404, msg);
    return sendError(reply, 500, msg);
  }
});

fastify.delete("/api/scenes/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  if (!id) return sendError(reply, 400, "id required");
  try {
    await sceneService.deleteScene(db, id);
    return reply.send({ ok: true });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("not found")) return sendError(reply, 404, msg);
    return sendError(reply, 500, msg);
  }
});

// ---- Integrations ----
fastify.get("/api/integrations/hass/status", { preHandler: [requireAuth] }, async () => ({
  ok: true, connected: hassConfigured(), hassUrl: process.env.HASS_URL || "",
}));

// ---- Music search (YouTube) ----
fastify.get("/api/music/search", { preHandler: [requireAuth] }, async (request, reply) => {
  const q = typeof request.query?.q === "string" ? request.query.q.trim() : "";
  if (!q) return sendError(reply, 400, "q required");
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const encoded = encodeURIComponent(q);
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encoded}&sp=EgIQAQ%3D%3D`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" }, signal: controller.signal }
    );
    clearTimeout(t);
    const html = await res.text();
    // Extract video data from ytInitialData
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!match) return reply.send({ ok: true, results: [] });
    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];
    const results = contents
      .filter((c) => c.videoRenderer)
      .slice(0, 8)
      .map((c) => {
        const v = c.videoRenderer;
        return {
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text ?? "Unknown",
          channel: v.ownerText?.runs?.[0]?.text ?? "",
          duration: v.lengthText?.simpleText ?? "",
          thumbnail: v.thumbnail?.thumbnails?.[0]?.url ?? "",
        };
      });
    return reply.send({ ok: true, results });
  } catch (e) {
    return reply.send({ ok: true, results: [] });
  }
});

// ---- AI ----
fastify.post("/api/ai/howto", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  if (typeof body.title !== "string" || !body.title.trim()) return sendError(reply, 400, "Invalid request");
  const result = await generateHowToAnswer({ title: body.title, context: body.context, type: body.type });
  if (result?.ok && result.answer?.trim()) return reply.send({ ok: true, answer: result.answer.trim() });
  const kind = result?.error === "OPENAI_NO_CREDITS" ? "NO_CREDITS" : result?.error === "OPENAI_INVALID_KEY" ? "INVALID_KEY" : result?.error === "OPENAI_ENV_MISSING" ? "ENV_MISSING" : "OPENAI_ERROR";
  return sendError(reply, 500, `${kind}: ${result?.detail || "OpenAI request failed"}`.slice(0, 200));
});

fastify.get("/api/ai/howto", { preHandler: [requireAuth] }, async (request, reply) => {
  const { taskTitle, context } = request.query || {};
  if (!taskTitle?.trim()) return sendError(reply, 400, "Invalid request");
  const result = await generateHowToAnswer({ title: taskTitle, context: context || "", type: "task" });
  if (result?.ok && result.answer?.trim()) return reply.send({ ok: true, answer: result.answer.trim() });
  const kind = result?.error === "OPENAI_NO_CREDITS" ? "NO_CREDITS" : result?.error === "OPENAI_INVALID_KEY" ? "INVALID_KEY" : result?.error === "OPENAI_ENV_MISSING" ? "ENV_MISSING" : "OPENAI_ERROR";
  return sendError(reply, 500, `${kind}: ${result?.detail || "OpenAI request failed"}`.slice(0, 200));
});

// ---- Devices (Home Assistant) ----
const DEVICE_POLL_INTERVAL_MS = 15_000;
let devicePollingInProgress = false;

async function deviceToggleHandler(request, reply) {
  const deviceId = request.params?.deviceId || request.params?.id;
  const on = request.body?.on;
  if (typeof deviceId !== "string" || !deviceId.trim()) return sendError(reply, 400, "deviceId required");
  if (typeof on !== "boolean") return sendError(reply, 400, "on must be boolean");
  try {
    const device = await deviceService.setDeviceState(deviceId.trim(), { switch: on });
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "toggled", entity_type: "device", entity_id: deviceId.trim(), payload_json: { on } });
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, device });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("offline") || msg.toLowerCase().includes("unavailable")) return sendError(reply, 400, "Device offline");
    return sendError(reply, 500, msg);
  }
}

fastify.get("/api/devices/raw", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const devices = await deviceService.getDevices(true);
    return reply.send({ ok: true, devices });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.get("/api/devices", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const room = request.query?.room;
    const devices = await deviceService.getDevices();
    const list = room ? devices.filter((d) => d.room === room) : devices;
    return reply.send({ ok: true, devices: list });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.post("/api/devices/:deviceId/toggle", { preHandler: [requireAuth] }, deviceToggleHandler);
fastify.post("/api/devices/:deviceId/switch", { preHandler: [requireAuth] }, deviceToggleHandler);
fastify.patch("/api/devices/:deviceId/toggle", { preHandler: [requireAuth] }, deviceToggleHandler);

// ---- Inventory ----
fastify.get("/api/inventory", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT * FROM inventory ORDER BY category ASC, name ASC");
    return reply.send({ ok: true, items: rows });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.post("/api/inventory", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return sendError(reply, 400, "name required");
  const category = typeof body.category === "string" ? body.category : "Food";
  const quantity = typeof body.quantity === "number" ? body.quantity : 1;
  const unit = typeof body.unit === "string" ? body.unit.trim() : "pcs";
  const expiration_date = body.expiration_date || body.expiry_date || null;
  const threshold = typeof body.threshold === "number" ? body.threshold : 2;
  let location = typeof body.location === "string" ? body.location.trim() : null;
  let default_location = typeof body.default_location === "string" ? body.default_location.trim() : null;
  try {
    // Check for duplicate: if item with same name exists, add to its quantity instead
    const { rows: existing } = await db.query("SELECT * FROM inventory WHERE LOWER(name) = LOWER($1) LIMIT 1", [name]);
    if (existing.length > 0) {
      const ex = existing[0];
      const newQty = (Number(ex.quantity) || 0) + quantity;
      const useLocation = location || ex.default_location || ex.location;
      const useDefault = default_location || ex.default_location;
      const { rows: updated } = await db.query(
        "UPDATE inventory SET quantity = $1, location = $2, default_location = $3, updated_at = now() WHERE id = $4 RETURNING *",
        [newQty, useLocation, useDefault, ex.id]
      );
      if (expiration_date) await db.query("UPDATE inventory SET expiration_date = $1 WHERE id = $2", [expiration_date, ex.id]);
      const actor = getActor(request);
      await logActivity(db, { ...actor, action: "updated", entity_type: "inventory", entity_id: String(ex.id), payload_json: { name, addedQty: quantity } });
      broadcast(fastify, "inventory_updated", {});
      return reply.send({ ok: true, item: updated[0], merged: true });
    }
    const { rows } = await db.query(
      "INSERT INTO inventory (name, category, quantity, unit, expiration_date, threshold, location, default_location, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *",
      [name, category, quantity, unit, expiration_date, threshold, location, default_location]
    );
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "created", entity_type: "inventory", entity_id: String(rows[0]?.id), payload_json: { name } });
    broadcast(fastify, "inventory_updated", {});
    return reply.code(201).send({ ok: true, item: rows[0] });
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

fastify.patch("/api/inventory/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};
  const fields = [], values = [];
  let i = 1;
  if (typeof body.name === "string" && body.name.trim()) { fields.push(`name = $${i++}`); values.push(body.name.trim()); }
  if (typeof body.category === "string") { fields.push(`category = $${i++}`); values.push(body.category); }
  if (typeof body.quantity === "number") { fields.push(`quantity = $${i++}`); values.push(body.quantity); }
  if (typeof body.unit === "string") { fields.push(`unit = $${i++}`); values.push(body.unit.trim()); }
  if (body.expiration_date !== undefined) { fields.push(`expiration_date = $${i++}`); values.push(body.expiration_date || null); }
  if (typeof body.threshold === "number") { fields.push(`threshold = $${i++}`); values.push(body.threshold); }
  if (body.location !== undefined) { fields.push(`location = $${i++}`); values.push(typeof body.location === "string" ? body.location.trim() : null); }
  if (body.default_location !== undefined) { fields.push(`default_location = $${i++}`); values.push(typeof body.default_location === "string" ? body.default_location.trim() : null); }
  if (!fields.length) return sendError(reply, 400, "No fields to update");
  fields.push(`updated_at = now()`);
  values.push(id);
  try {
    const { rows } = await db.query(`UPDATE inventory SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
    if (!rows[0]) return sendError(reply, 404, "Item not found");
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "updated", entity_type: "inventory", entity_id: id, payload_json: {} });
    broadcast(fastify, "inventory_updated", {});
    return reply.send({ ok: true, item: rows[0] });
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

fastify.delete("/api/inventory/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const { id } = request.params;
  try {
    const result = await db.query("DELETE FROM inventory WHERE id = $1 RETURNING id", [id]);
    if (!result.rows.length) return sendError(reply, 404, "Item not found");
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "deleted", entity_type: "inventory", entity_id: id, payload_json: {} });
    broadcast(fastify, "inventory_updated", {});
    return reply.send({ ok: true });
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

fastify.post("/api/inventory/audit-photo", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const image = typeof body.image === "string" ? body.image : "";
  if (!image) return sendError(reply, 400, "image (base64) required");
  try {
    const { analyzeInventoryPhoto } = await import("./openaiClient.js");
    const expectedItems = Array.isArray(body.expectedItems) ? body.expectedItems.map(String) : [];
    const result = await analyzeInventoryPhoto(image, expectedItems);
    if (!result.ok) return sendError(reply, 500, result.detail || result.error || "AI analysis failed");
    return reply.send({ ok: true, found: result.found ?? [], unexpected: result.unexpected ?? [] });
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

// ---- Meals (list) ----
fastify.get("/api/meals", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT id, type, dish, drink, portions, requested_by FROM meals ORDER BY type ASC");
    return reply.send({ ok: true, meals: rows });
  } catch (e) {
    return reply.send({ ok: true, meals: [] });
  }
});

fastify.post("/api/meals", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const type = typeof body.type === "string" ? body.type : "lunch";
  const dish = typeof body.dish === "string" ? body.dish.trim() : "";
  if (!dish) return sendError(reply, 400, "dish required");
  const drink = typeof body.drink === "string" ? body.drink.trim() : null;
  const portions = typeof body.portions === "number" ? body.portions : 1;
  const requested_by = typeof body.requested_by === "string" ? body.requested_by.trim() : (body.actorName || null);
  try {
    const { rows } = await db.query(
      "INSERT INTO meals (type, dish, drink, portions, requested_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [type, dish, drink, portions, requested_by]
    );
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "created", entity_type: "meal", entity_id: String(rows[0]?.id), payload_json: { dish } });
    broadcast(fastify, "meals_updated", {});
    return reply.code(201).send({ ok: true, meal: rows[0] });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

// ---- API devices (service layer) ----
fastify.post("/api/meals/suggestions", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const inventory = Array.isArray(body.inventory) ? body.inventory.map(String) : [];
  const expiringSoon = Array.isArray(body.expiringSoon) ? body.expiringSoon.map(String) : [];
  const householdSize = typeof body.householdSize === "number" ? body.householdSize : 2;
  try {
    const suggestions = await mealAIService.getAIMealSuggestions({ inventory, expiringSoon, householdSize });
    return reply.send({ ok: true, suggestions });
  } catch (e) {
    return reply.send({ ok: true, suggestions: [] });
  }
});

fastify.get("/api/devices/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  if (!id) return sendError(reply, 400, "id required");
  try {
    const status = await deviceService.getDeviceStatus(id);
    return reply.send({ ok: true, device: status });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.post("/api/devices/:id/control", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const body = request.body || {};
  if (!id) return sendError(reply, 400, "id required");
  try {
    const command = {};
    if (typeof body.switch === "boolean") command.switch = body.switch;
    if (typeof body.brightness === "number") command.brightness = body.brightness;
    if (typeof body.temperature === "number") command.temperature = body.temperature;
    if (body.fanSpeed !== undefined && body.fanSpeed !== null) command.fanSpeed = body.fanSpeed;
    if (typeof body.blindsOpen === "boolean") command.blindsOpen = body.blindsOpen;
    if (Object.keys(command).length === 0) return sendError(reply, 400, "command.switch, brightness, temperature, fanSpeed, or blindsOpen required");
    const device = await deviceService.setDeviceState(id, command);
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, device });
  } catch (e) {
    const msg = safeErrorMessage(e);
    if (msg.toLowerCase().includes("offline")) return sendError(reply, 400, "Device offline");
    return sendError(reply, 500, msg);
  }
});

// Background device polling: every 15s refresh state and emit devices_updated (no overlap)
setInterval(async () => {
  if (devicePollingInProgress || !hassConfigured()) return;
  devicePollingInProgress = true;
  try {
    await deviceService.getDevices(true);
    broadcast(fastify, "devices_updated", {});
  } catch {
    // ignore
  } finally {
    devicePollingInProgress = false;
  }
}, DEVICE_POLL_INTERVAL_MS);

// Device health monitoring: every 2 min check devices, create notifications for offline/unhealthy
startDeviceHealthScheduler(db, {});

// ---- Daily Tasks ----
const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validTime(s) { return typeof s === "string" && TIME_REGEX.test(s.trim()); }
function validDate(s) { return typeof s === "string" && DATE_REGEX.test(s.trim()) && !isNaN(new Date(s + "T12:00:00Z").getTime()); }
function validRecurrence(s) { return s === "none" || s === "daily" || s === "weekly"; }

fastify.get("/api/daily-tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const staffUserId = request.query?.staff_user_id;
  if (!staffUserId || !Number.isInteger(Number(staffUserId))) return sendError(reply, 400, "staff_user_id required (integer)");
  const dateStr = request.query?.date && validDate(request.query.date) ? request.query.date.trim() : new Date().toISOString().slice(0, 10);
  const result = await dailyTasksDb.getTasksWithInstances(db, Number(staffUserId), dateStr);
  return reply.send({ ok: true, ...result });
});

fastify.post("/api/daily-tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const { staff_user_id, window_start, window_end, start_date, end_date } = body;
  const title = (body.title || "").trim();
  const notes = (body.notes || "").trim();
  const timezone = (body.timezone || "Asia/Bahrain").trim();
  const recurrence = validRecurrence(body.recurrence) ? body.recurrence : "none";
  let recurrence_days = body.recurrence_days;
  if (!staff_user_id || !Number.isInteger(Number(staff_user_id))) return sendError(reply, 400, "staff_user_id required (integer)");
  if (!title) return sendError(reply, 400, "title required");
  if (!validTime(window_start)) return sendError(reply, 400, "window_start required (HH:MM or HH:MM:SS)");
  if (!validTime(window_end)) return sendError(reply, 400, "window_end required (HH:MM or HH:MM:SS)");
  if (!validDate(start_date)) return sendError(reply, 400, "start_date required (YYYY-MM-DD)");
  if (recurrence === "weekly" && Array.isArray(recurrence_days)) recurrence_days = recurrence_days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
  else recurrence_days = null;
  const row = await dailyTasksDb.createDailyTask(db, { staff_user_id: Number(staff_user_id), title, notes, window_start: String(window_start).trim(), window_end: String(window_end).trim(), timezone, recurrence, recurrence_days, start_date: String(start_date).trim(), end_date: end_date && validDate(end_date) ? end_date.trim() : null });
  return reply.code(201).send({ ok: true, data: row });
});

fastify.patch("/api/daily-tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  if (!id || !Number.isInteger(Number(id))) return sendError(reply, 400, "id required");
  const body = request.body || {};
  const payload = {};
  if (typeof body.title === "string" && body.title.trim()) payload.title = body.title.trim();
  if (typeof body.notes === "string") payload.notes = body.notes.trim();
  if (validTime(body.window_start)) payload.window_start = body.window_start.trim();
  if (validTime(body.window_end)) payload.window_end = body.window_end.trim();
  if (typeof body.timezone === "string") payload.timezone = body.timezone.trim() || "Asia/Bahrain";
  if (validRecurrence(body.recurrence)) payload.recurrence = body.recurrence;
  if (Array.isArray(body.recurrence_days)) payload.recurrence_days = body.recurrence_days.filter(d => Number.isInteger(Number(d)) && Number(d) >= 0 && Number(d) <= 6);
  if (validDate(body.start_date)) payload.start_date = body.start_date.trim();
  if (body.end_date !== undefined) payload.end_date = body.end_date && validDate(body.end_date) ? body.end_date.trim() : null;
  if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
  const row = await dailyTasksDb.updateDailyTask(db, Number(id), payload);
  if (!row) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true, data: row });
});

fastify.post("/api/daily-tasks/:id/complete", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const date = request.body?.date ?? request.query?.date ?? new Date().toISOString().slice(0, 10);
  if (!id || !Number.isInteger(Number(id))) return sendError(reply, 400, "id required");
  if (!validDate(date)) return sendError(reply, 400, "date required (YYYY-MM-DD)");
  const instance = await dailyTasksDb.completeInstance(db, Number(id), date.trim());
  if (!instance) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true, data: instance });
});

fastify.post("/api/daily-tasks/:id/skip", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const date = request.body?.date ?? request.query?.date ?? new Date().toISOString().slice(0, 10);
  if (!id || !Number.isInteger(Number(id))) return sendError(reply, 400, "id required");
  if (!validDate(date)) return sendError(reply, 400, "date required (YYYY-MM-DD)");
  const instance = await dailyTasksDb.skipInstance(db, Number(id), date.trim());
  if (!instance) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true, data: instance });
});

// ---- Legacy task routes ----
fastify.post("/api/legacy/tasks", { preHandler: [requireAuth] }, async (request) => {
  const { title, assigned_to, day_of_week } = request.body;
  const { rows } = await db.query("INSERT INTO tasks (title, assigned_to, day_of_week) VALUES ($1, $2, $3) RETURNING *", [title, assigned_to, day_of_week]);
  return rows[0];
});

fastify.get("/api/legacy/tasks/today/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2", [request.params.userId, new Date().getDay()]);
  return rows;
});

fastify.get("/api/legacy/tasks/assigned/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY id DESC", [request.params.userId]);
  return rows;
});

fastify.get("/api/legacy/tasks", { preHandler: [requireAuth] }, async () => {
  const { rows } = await db.query("SELECT * FROM tasks ORDER BY id DESC");
  return rows;
});

fastify.get("/api/legacy/tasks/today", { preHandler: [requireAuth] }, async () => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE day_of_week = $1 ORDER BY id DESC", [new Date().getDay()]);
  return rows;
});

fastify.post("/api/urgent_tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  let assigned_to = body.assigned_to;
  if ((assigned_to == null || assigned_to === "") && body.assigned_to_name?.trim()) assigned_to = await findUserIdByName(body.assigned_to_name.trim());
  try {
    const task = await createUrgentTask({
      title: body.title, assigned_to, priority: body.priority,
      alert_on_free: body.alert_on_free, submitted_by: body.submitted_by || body.actorName,
    });
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "created", entity_type: "urgent_task", entity_id: String(task?.id), payload_json: { title: body.title } });
    broadcast(fastify, "urgent_updated", {});
    // If alert flag is set, fire urgent_alert to all clients
    if (body.alert) {
      broadcast(fastify, "urgent_alert", { id: task.id, title: task.title, submittedBy: task.submitted_by });
    }
    return reply.send(task);
  } catch (e) { return sendError(reply, 400, "Invalid urgent task"); }
});

fastify.get("/api/urgent_tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT * FROM urgent_tasks ORDER BY acknowledged ASC, priority DESC, id DESC");
    return reply.send(rows ?? []);
  } catch (e) {
    request.log.warn(e, "urgent_tasks list failed");
    return reply.send([]);
  }
});

fastify.get("/api/urgent_tasks/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM urgent_tasks WHERE assigned_to = $1 ORDER BY id DESC", [request.params.userId]);
  return rows;
});

fastify.patch("/api/urgent_tasks/:id/ack", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params.id;
  const { rows } = await db.query("UPDATE urgent_tasks SET acknowledged = true WHERE id = $1 RETURNING *", [id]);
  if (!rows[0]) return sendError(reply, 404, "Urgent task not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "toggled", entity_type: "urgent_task", entity_id: id, payload_json: { acknowledged: true } });
  broadcast(fastify, "urgent_updated", {});
  broadcast(fastify, "urgent_alert_ack", { id });
  return reply.send(rows[0]);
});

fastify.get("/api/today/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { userId } = request.params;
  const today = new Date().getDay();
  const urgent = await db.query("SELECT * FROM urgent_tasks WHERE assigned_to = $1 AND acknowledged = false ORDER BY id DESC", [userId]);
  const normal = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2 ORDER BY id DESC", [userId, today]);
  return { urgent: urgent.rows, tasks: normal.rows };
});

fastify.patch("/api/urgent_tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};
  const fields = [], values = [];
  let i = 1;
  if (typeof body.acknowledged === "boolean") { fields.push(`acknowledged = $${i++}`); values.push(body.acknowledged); }
  if (typeof body.title === "string" && body.title.trim()) { fields.push(`title = $${i++}`); values.push(body.title.trim()); }
  if (!fields.length) return sendError(reply, 400, "Invalid body");
  values.push(id);
  const { rows } = await db.query(`UPDATE urgent_tasks SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
  if (!rows[0]) return sendError(reply, 404, "Urgent task not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "updated", entity_type: "urgent_task", entity_id: id, payload_json: {} });
  broadcast(fastify, "urgent_updated", {});
  return reply.send(rows[0]);
});

fastify.patch("/api/legacy/tasks/:taskId/toggle", { preHandler: [requireAuth] }, async (request, reply) => {
  const result = await db.query("UPDATE tasks SET is_done = NOT is_done WHERE id = $1 RETURNING *", [request.params.taskId]);
  if (!result.rows.length) return sendError(reply, 404, "Task not found");
  return reply.send(result.rows[0]);
});

fastify.patch("/api/legacy/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};
  const fields = [], values = [];
  let i = 1;
  if (typeof body.is_done === "boolean") { fields.push(`is_done = $${i++}`); values.push(body.is_done); }
  if (typeof body.title === "string" && body.title.trim()) { fields.push(`title = $${i++}`); values.push(body.title.trim()); }
  if (!fields.length) return sendError(reply, 400, "Invalid body");
  values.push(id);
  const result = await db.query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`, values);
  if (!result.rows.length) return sendError(reply, 404, "Task not found");
  return reply.send(result.rows[0]);
});

fastify.delete("/api/legacy/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [request.params.id]);
  if (!result.rows.length) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true });
});

fastify.delete("/api/urgent_tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params.id;
  const result = await db.query("DELETE FROM urgent_tasks WHERE id = $1 RETURNING id", [id]);
  if (!result.rows.length) return sendError(reply, 404, "Urgent task not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "deleted", entity_type: "urgent_task", entity_id: id, payload_json: {} });
  broadcast(fastify, "urgent_updated", {});
  return reply.send({ ok: true });
});

// ---- Static files ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
await fastify.register(fastifyStatic, { root: __dirname });

// ---- Global error handler ----
fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ err: safeErrorMessage(error) }, "error");
  return sendError(reply, 500, safeErrorMessage(error));
});

// ---- Graceful shutdown ----
async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  try { await fastify.close(); await db.end(); process.exit(0); }
  catch (e) { console.error("Shutdown error:", e.message); process.exit(1); }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const port = Number(process.env.PORT) || 4000;
try {
  sceneScheduler.start(db, {
    createUrgentTask,
    logActivity,
    getActor: (req) => getActor(req),
    broadcast: (event, payload) => broadcast(fastify, event, payload || {}),
  });
} catch (e) {
  console.warn("Scene scheduler start warning:", e?.message || e);
}
fastify.listen({ port }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  console.log(`Server running on http://localhost:${port}`);
});
