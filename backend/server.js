import "dotenv/config";
import Fastify from "fastify";
import pg from "pg";
import cors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import { getDevices, getDeviceStatus, getDeviceState, getDevicesCached, setDeviceSwitch, turnOffIfOn, listDevices } from "./tuyaClient.js";
import { generateHowToAnswer } from "./openaiClient.js";
import * as dailyTasksDb from "./lib/dailyTasksDb.js";
import { getActor, logActivity, broadcast } from "./lib/activityLog.js";
import authRoutes from "./routes/auth.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import ROLES from "./constants/roles.js";

// ---- Startup validation: required ENV (exit if missing) ----
const requiredTuyaEnv = ["TUYA_ACCESS_ID", "TUYA_ACCESS_SECRET", "TUYA_ENDPOINT", "TUYA_DEVICE_IDS"];
const missing = requiredTuyaEnv.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
if (missing.length > 0) {
  console.error("Missing required ENV:", missing.join(", "));
  process.exit(1);
}
console.log("ENV loaded");
console.log("Tuya client initialized ✅");
// ---- Helpers ----

function safeErrorMessage(e) {
  if (e == null) return "Server error";
  const msg = e instanceof Error ? e.message : String(e);
  return (msg && msg.slice(0, 200)) || "Server error";
}

function sendError(reply, code, error) {
  return reply.code(code).send({ ok: false, error: String(error).slice(0, 200) });
}

const fastify = Fastify({ logger: true });

fastify.addHook("onRequest", async (request) => {
  request.log.info({ method: request.method, url: request.url }, "route hit");
});

await fastify.register(cors, {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
});
await fastify.register(fastifyWebsocket, {
  options: {
    verifyClient: (info, next) => {
      const origin = info.origin || info.req?.headers?.origin;
      const ok = !origin || origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
      next(ok);
    },
  },
});

const db = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
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

async function createUrgentTask({ title, assigned_to }) {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) throw new Error("title required");
  const assigned = typeof assigned_to === "number" && Number.isFinite(assigned_to) ? assigned_to : null;
  const { rows } = await db.query("INSERT INTO urgent_tasks (title, assigned_to) VALUES ($1, $2) RETURNING *", [t, assigned]);
  return rows[0];
}

// =============================================
// PUBLIC ROUTES
// =============================================

fastify.get("/", async () => ({ ok: true, status: "Smart Home Hub backend running" }));
fastify.get("/health", async () => ({ ok: true }));

fastify.get("/weather", async (request, reply) => {
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

fastify.get("/env-status", async () => ({
  ok: true,
  hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  hasTuya: Boolean(process.env.TUYA_ACCESS_ID && process.env.TUYA_ACCESS_SECRET && process.env.TUYA_ENDPOINT),
  tuyaEndpoint: process.env.TUYA_ENDPOINT || "",
}));

// WebSocket: real-time events (no auth for simplicity; origin verified in verifyClient)
fastify.get("/ws", { websocket: true }, (socket, req) => {
  socket.on("message", () => {});
  socket.on("close", () => {});
});

// =============================================
// PROTECTED ROUTES
// =============================================

fastify.get("/activity", { preHandler: [requireAuth] }, async (request, reply) => {
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
fastify.get("/users", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT id, name, role, created_at FROM users ORDER BY id");
    return reply.send(rows.length ? rows : [{ id: 1, name: "Admin", role: "admin", created_at: new Date().toISOString() }]);
  } catch (e) { return sendError(reply, 500, safeErrorMessage(e)); }
});

fastify.post("/users", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, async (request) => {
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
    const window = body.timeWindow && TASK_TIME_WINDOWS[body.timeWindow] ? TASK_TIME_WINDOWS[body.timeWindow] : null;
    const timeStr = body.startTime || (window ? window.start : "09:00");
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(timeStr))) { startTime = `${dateStr}T${String(timeStr).length === 5 ? `${timeStr}:00` : timeStr}`; }
    else { startTime = new Date(body.startTime).toISOString(); }
    endTime = body.endTime || new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
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
  if (body.durationMinutes != null) task.durationMinutes = Number(body.durationMinutes);
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

fastify.get("/groceries", { preHandler: [requireAuth] }, async (request, reply) => {
  const { rows } = await db.query("SELECT * FROM groceries ORDER BY id DESC");
  return reply.send(rows);
});

fastify.post("/groceries", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  const title = (body.name || body.title || "").trim();
  if (!title) return sendError(reply, 400, "Invalid name");
  const { rows } = await db.query("INSERT INTO groceries (title, requested_by) VALUES ($1, $2) RETURNING *", [title, body.requestedBy === "abood" ? "abood" : "family"]);
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "created", entity_type: "grocery", entity_id: String(rows[0]?.id), payload_json: { title } });
  broadcast(fastify, "groceries_updated", {});
  return reply.send(rows[0]);
});

fastify.patch("/groceries/:id", { preHandler: [requireAuth] }, async (request, reply) => {
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

fastify.delete("/groceries/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params.id;
  const result = await db.query("DELETE FROM groceries WHERE id = $1 RETURNING id", [id]);
  if (!result.rows.length) return sendError(reply, 404, "Not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "deleted", entity_type: "grocery", entity_id: id, payload_json: {} });
  broadcast(fastify, "groceries_updated", {});
  return reply.send({ ok: true });
});

// ---- Scenes ----
fastify.post("/scenes/:sceneId", { preHandler: [requireAuth] }, async (request, reply) => {
  const { sceneId } = request.params;
  const scenes = {
    shower: { sceneName: "Shower Mode", emoji: "🚿", message: "Towel heaters ON for 45 minutes", duration_minutes: 45 },
    away: { sceneName: "Away Mode", emoji: "🚪", message: "Doors locked • Lights off", duration_minutes: null },
    sleep: { sceneName: "Sleep Mode", emoji: "🌙", message: "Lights off • Quiet • AC off", duration_minutes: null },
    gathering: { sceneName: "Gathering Mode", emoji: "🍷", message: "Let's get ready!", duration_minutes: null },
  };
  const s = scenes[sceneId];
  if (!s) return sendError(reply, 400, "Unknown scene");

  if (sceneId === "shower") {
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "scene_run", entity_type: "device", entity_id: sceneId, payload_json: {} });
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, sceneId, ...s, results: { stub: true } });
  }

  if (sceneId === "gathering") {
    const gt = request.body?.gatheringType;
    if (!["bahram", "haffadh", "friends"].includes(gt)) return sendError(reply, 400, "Invalid gatheringType");
    const aboodId = await findUserIdByName("Abood");
    const titles = { bahram: ["Prepare living room for Bahram family", "Set tea, dates & snacks", "Check bathroom supplies"], haffadh: ["Prepare living room for Haffadh family", "Set drinks & snacks", "Check bathroom supplies"], friends: ["Prepare living room for friends", "Set drinks & snacks", "Check bathroom supplies"] };
    const created = [];
    for (const title of titles[gt]) { try { created.push(await createUrgentTask({ title, assigned_to: aboodId })); } catch {} }
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "scene_run", entity_type: "device", entity_id: sceneId, payload_json: { gatheringType: gt } });
    broadcast(fastify, "urgent_updated", {});
    broadcast(fastify, "devices_updated", {});
    return reply.send({ ok: true, sceneId, ...s, message: "Gathering Mode prepared", results: { gatheringType: gt, created_urgent_tasks: created } });
  }

  const awayIds = (process.env.AWAY_DEVICE_IDS || "bf764156746c04629ds53u,bf7e312cdc1833bcd1vtwq,bf5267cc9a40db55fdewu1").split(",").map(s => s.trim()).filter(Boolean);
  const sleepIds = (process.env.SLEEP_EXTRA_DEVICE_IDS || "bf1b3f05e130f44ea0sy5w,bf1cd69a2f640b4d5ewslp,bf6b932ae27f7f2edeycd6").split(",").map(s => s.trim()).filter(Boolean);
  const deviceIds = sceneId === "sleep" ? [...awayIds, ...sleepIds] : awayIds;
  const settled = await Promise.allSettled(deviceIds.map((d) => turnOffIfOn(d)));
  const results = settled.map((r, idx) => r.status === "fulfilled" ? r.value : { deviceId: deviceIds[idx], attempted: true, already_off: false, turned_off: false, offline: false, error: String(r.reason?.message || "Tuya error") });
  const counts = { turned_off: results.filter(x => x.turned_off).length, already_off: results.filter(x => x.already_off).length, offline: results.filter(x => x.offline).length, error: results.filter(x => x.error).length };
  const msgParts = [];
  if (counts.turned_off) msgParts.push(`${counts.turned_off} turned off`);
  if (counts.already_off) msgParts.push(`${counts.already_off} already off`);
  if (counts.offline) msgParts.push(`${counts.offline} offline`);
  if (counts.error) msgParts.push(`${counts.error} error`);
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "scene_run", entity_type: "device", entity_id: sceneId, payload_json: { counts } });
  broadcast(fastify, "devices_updated", {});
  return reply.send({ ok: true, sceneId, ...s, message: msgParts.join(" • ") || s.message, results });
});

// ---- Integrations ----
fastify.post("/integrations/tuya/trigger", { preHandler: [requireAuth] }, async (request, reply) => reply.send({ ok: true, action: request.body?.action || "", payload: request.body?.payload, note: "Tuya integration stub" }));
fastify.get("/integrations/tuya/status", { preHandler: [requireAuth] }, async () => ({ ok: true, connected: false, message: "Tuya integration not configured yet" }));
fastify.post("/integrations/tuya/device/:deviceId/command", { preHandler: [requireAuth] }, async (request, reply) => reply.send({ ok: true, sent: true, deviceId: String(request.params.deviceId || ""), command: request.body?.command || "", value: request.body?.value }));

// ---- AI ----
fastify.post("/ai/howto", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  if (typeof body.title !== "string" || !body.title.trim()) return sendError(reply, 400, "Invalid request");
  const result = await generateHowToAnswer({ title: body.title, context: body.context, type: body.type });
  if (result?.ok && result.answer?.trim()) return reply.send({ ok: true, answer: result.answer.trim() });
  const kind = result?.error === "OPENAI_NO_CREDITS" ? "NO_CREDITS" : result?.error === "OPENAI_INVALID_KEY" ? "INVALID_KEY" : result?.error === "OPENAI_ENV_MISSING" ? "ENV_MISSING" : "OPENAI_ERROR";
  return sendError(reply, 500, `${kind}: ${result?.detail || "OpenAI request failed"}`.slice(0, 200));
});

fastify.get("/ai/howto", { preHandler: [requireAuth] }, async (request, reply) => {
  const { taskTitle, context } = request.query || {};
  if (!taskTitle?.trim()) return sendError(reply, 400, "Invalid request");
  const result = await generateHowToAnswer({ title: taskTitle, context: context || "", type: "task" });
  if (result?.ok && result.answer?.trim()) return reply.send({ ok: true, answer: result.answer.trim() });
  const kind = result?.error === "OPENAI_NO_CREDITS" ? "NO_CREDITS" : result?.error === "OPENAI_INVALID_KEY" ? "INVALID_KEY" : result?.error === "OPENAI_ENV_MISSING" ? "ENV_MISSING" : "OPENAI_ERROR";
  return sendError(reply, 500, `${kind}: ${result?.detail || "OpenAI request failed"}`.slice(0, 200));
});

// ---- Devices ----
const DEVICE_POLL_INTERVAL_MS = 15_000;
let devicePollingInProgress = false;

function getDeviceAllowIds() {
  const raw = (process.env.TUYA_DEVICE_IDS || "").trim();
  return raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

async function deviceToggleHandler(request, reply) {
  const deviceId = request.params?.deviceId || request.params?.id;
  const on = request.body?.on;
  if (typeof deviceId !== "string" || !deviceId.trim()) return sendError(reply, 400, "deviceId required");
  if (typeof on !== "boolean") return sendError(reply, 400, "on must be boolean");
  const trimmedId = deviceId.trim();

  let stateBefore;
  try {
    stateBefore = await getDeviceState(trimmedId);
  } catch (e) {
    return sendError(reply, 500, "Failed to fetch device state");
  }
  if (!stateBefore.isOnline) {
    return sendError(reply, 400, "Device offline");
  }

  const tuyaResponse = await setDeviceSwitch(trimmedId, on);
  if (!tuyaResponse?.ok) {
    const msg = tuyaResponse?.error || "Tuya command failed";
    if (String(msg).toLowerCase().includes("offline")) return sendError(reply, 400, "Device offline");
    return sendError(reply, 500, msg);
  }

  let deviceAfter;
  try {
    deviceAfter = await getDeviceState(trimmedId);
  } catch {
    deviceAfter = { ...stateBefore, powerState: on, lastUpdated: new Date().toISOString() };
  }
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "toggled", entity_type: "device", entity_id: trimmedId, payload_json: { on } });
  broadcast(fastify, "devices_updated", {});
  return reply.send({ ok: true, device: deviceAfter });
}

fastify.get("/devices", { preHandler: [requireAuth] }, async (request, reply) => {
  try {
    const allowIds = getDeviceAllowIds();
    const devices = await getDevicesCached(allowIds.length ? allowIds : null);  
    console.log("DEVICES RAW:", devices);
    return reply.send({ ok: true, devices });
  } catch (e) {
    return sendError(reply, 500, safeErrorMessage(e));
  }
});

fastify.post("/devices/:deviceId/toggle", { preHandler: [requireAuth] }, deviceToggleHandler);
fastify.post("/devices/:deviceId/switch", { preHandler: [requireAuth] }, deviceToggleHandler);
fastify.patch("/devices/:id/toggle", { preHandler: [requireAuth] }, deviceToggleHandler);

// Background device polling: every 15s refresh state and emit devices_updated (no overlap)
setInterval(async () => {
  if (devicePollingInProgress) return;
  devicePollingInProgress = true;
  try {
    const allowIds = getDeviceAllowIds();
    await getDevicesCached(allowIds.length ? allowIds : null, true);
    broadcast(fastify, "devices_updated", {});
  } catch {
    // ignore
  } finally {
    devicePollingInProgress = false;
  }
}, DEVICE_POLL_INTERVAL_MS);

// ---- Daily Tasks ----
const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validTime(s) { return typeof s === "string" && TIME_REGEX.test(s.trim()); }
function validDate(s) { return typeof s === "string" && DATE_REGEX.test(s.trim()) && !isNaN(new Date(s + "T12:00:00Z").getTime()); }
function validRecurrence(s) { return s === "none" || s === "daily" || s === "weekly"; }

fastify.get("/daily-tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const staffUserId = request.query?.staff_user_id;
  if (!staffUserId || !Number.isInteger(Number(staffUserId))) return sendError(reply, 400, "staff_user_id required (integer)");
  const dateStr = request.query?.date && validDate(request.query.date) ? request.query.date.trim() : new Date().toISOString().slice(0, 10);
  const result = await dailyTasksDb.getTasksWithInstances(db, Number(staffUserId), dateStr);
  return reply.send({ ok: true, ...result });
});

fastify.post("/daily-tasks", { preHandler: [requireAuth] }, async (request, reply) => {
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

fastify.patch("/daily-tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
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

fastify.post("/daily-tasks/:id/complete", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const date = request.body?.date ?? request.query?.date ?? new Date().toISOString().slice(0, 10);
  if (!id || !Number.isInteger(Number(id))) return sendError(reply, 400, "id required");
  if (!validDate(date)) return sendError(reply, 400, "date required (YYYY-MM-DD)");
  const instance = await dailyTasksDb.completeInstance(db, Number(id), date.trim());
  if (!instance) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true, data: instance });
});

fastify.post("/daily-tasks/:id/skip", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params?.id;
  const date = request.body?.date ?? request.query?.date ?? new Date().toISOString().slice(0, 10);
  if (!id || !Number.isInteger(Number(id))) return sendError(reply, 400, "id required");
  if (!validDate(date)) return sendError(reply, 400, "date required (YYYY-MM-DD)");
  const instance = await dailyTasksDb.skipInstance(db, Number(id), date.trim());
  if (!instance) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true, data: instance });
});

// ---- Legacy task routes ----
fastify.post("/tasks", { preHandler: [requireAuth] }, async (request) => {
  const { title, assigned_to, day_of_week } = request.body;
  const { rows } = await db.query("INSERT INTO tasks (title, assigned_to, day_of_week) VALUES ($1, $2, $3) RETURNING *", [title, assigned_to, day_of_week]);
  return rows[0];
});

fastify.get("/tasks/today/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2", [request.params.userId, new Date().getDay()]);
  return rows;
});

fastify.get("/tasks/assigned/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY id DESC", [request.params.userId]);
  return rows;
});

fastify.get("/tasks", { preHandler: [requireAuth] }, async () => {
  const { rows } = await db.query("SELECT * FROM tasks ORDER BY id DESC");
  return rows;
});

fastify.get("/tasks/today", { preHandler: [requireAuth] }, async () => {
  const { rows } = await db.query("SELECT * FROM tasks WHERE day_of_week = $1 ORDER BY id DESC", [new Date().getDay()]);
  return rows;
});

fastify.post("/urgent_tasks", { preHandler: [requireAuth] }, async (request, reply) => {
  const body = request.body || {};
  let assigned_to = body.assigned_to;
  if ((assigned_to == null || assigned_to === "") && body.assigned_to_name?.trim()) assigned_to = await findUserIdByName(body.assigned_to_name.trim());
  try {
    const task = await createUrgentTask({ title: body.title, assigned_to });
    const actor = getActor(request);
    await logActivity(db, { ...actor, action: "created", entity_type: "urgent_task", entity_id: String(task?.id), payload_json: { title: body.title } });
    broadcast(fastify, "urgent_updated", {});
    return reply.send(task);
  } catch (e) { return sendError(reply, 400, "Invalid urgent task"); }
});

fastify.get("/urgent_tasks", { preHandler: [requireAuth] }, async () => {
  const { rows } = await db.query("SELECT * FROM urgent_tasks ORDER BY id DESC");
  return rows;
});

fastify.get("/urgent_tasks/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { rows } = await db.query("SELECT * FROM urgent_tasks WHERE assigned_to = $1 ORDER BY id DESC", [request.params.userId]);
  return rows;
});

fastify.patch("/urgent_tasks/:id/ack", { preHandler: [requireAuth] }, async (request, reply) => {
  const id = request.params.id;
  const { rows } = await db.query("UPDATE urgent_tasks SET acknowledged = true WHERE id = $1 RETURNING *", [id]);
  if (!rows[0]) return sendError(reply, 404, "Urgent task not found");
  const actor = getActor(request);
  await logActivity(db, { ...actor, action: "toggled", entity_type: "urgent_task", entity_id: id, payload_json: { acknowledged: true } });
  broadcast(fastify, "urgent_updated", {});
  return reply.send(rows[0]);
});

fastify.get("/today/:userId", { preHandler: [requireAuth] }, async (request) => {
  const { userId } = request.params;
  const today = new Date().getDay();
  const urgent = await db.query("SELECT * FROM urgent_tasks WHERE assigned_to = $1 AND acknowledged = false ORDER BY id DESC", [userId]);
  const normal = await db.query("SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2 ORDER BY id DESC", [userId, today]);
  return { urgent: urgent.rows, tasks: normal.rows };
});

fastify.patch("/urgent_tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
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

fastify.patch("/tasks/:taskId/toggle", { preHandler: [requireAuth] }, async (request, reply) => {
  const result = await db.query("UPDATE tasks SET is_done = NOT is_done WHERE id = $1 RETURNING *", [request.params.taskId]);
  if (!result.rows.length) return sendError(reply, 404, "Task not found");
  return reply.send(result.rows[0]);
});

fastify.patch("/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
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

fastify.delete("/tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
  const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [request.params.id]);
  if (!result.rows.length) return sendError(reply, 404, "Task not found");
  return reply.send({ ok: true });
});

fastify.delete("/urgent_tasks/:id", { preHandler: [requireAuth] }, async (request, reply) => {
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
fastify.listen({ port }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  console.log(`Server running on http://localhost:${port}`);
});
