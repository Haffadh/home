import "dotenv/config";
import Fastify from "fastify";
import pg from "pg";
import cors from "@fastify/cors";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import { getDevices, getDeviceStatus, setDeviceSwitch, turnOffIfOn, listDevices } from "./tuyaClient.js";
import { generateHowToAnswer } from "./openaiClient.js";

const fastify = Fastify({ logger: true });

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasTuya = Boolean(process.env.TUYA_ACCESS_ID && process.env.TUYA_ACCESS_SECRET && process.env.TUYA_ENDPOINT);
// Startup log (safe: no secrets)
console.log(
  `ENV loaded: OPENAI_API_KEY ${hasOpenAI ? "✅" : "❌"}, TUYA ${hasTuya ? "✅" : "❌"}`
);

await fastify.register(cors, {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
});

const db = new pg.Pool({
  host: "localhost",
  user: "postgres",
  password: "postgres",
  database: "smarthub",
  port: 5432,
});

// Daily reset (midnight): clear completed/ticked items
let lastCleanupDay = new Date().toDateString();
setInterval(async () => {
  try {
    const now = new Date();
    const day = now.toDateString();
    if (day === lastCleanupDay) return;
    lastCleanupDay = day;

    // Reset recurring tasks (so they re-appear next day)
    await db.query("UPDATE tasks SET is_done = false WHERE is_done = true");

    // Remove acknowledged urgent tasks (so they disappear after midnight)
    await db.query("DELETE FROM urgent_tasks WHERE acknowledged = true");

    // Remove bought groceries
    await db.query("DELETE FROM groceries WHERE is_done = true");

    console.log("Daily reset ran ✅");
  } catch (e) {
    console.error("Daily reset failed", e);
  }
}, 60_000);

async function findUserIdByName(name) {
  try {
    const { rows } = await db.query(
      "SELECT id FROM users WHERE LOWER(name) = LOWER($1) ORDER BY id ASC LIMIT 1",
      [name]
    );
    return rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function createUrgentTask({ title, assigned_to }) {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t) throw new Error("title required");

  const assigned =
    typeof assigned_to === "number" && Number.isFinite(assigned_to) ? assigned_to : null;

  const { rows } = await db.query(
    `
    INSERT INTO urgent_tasks (title, assigned_to)
    VALUES ($1, $2)
    RETURNING *
    `,
    [t, assigned]
  );
  return rows[0];
}
fastify.get("/users", async () => {
  return [{ id: 1, name: "Admin", role: "admin", created_at: new Date().toISOString() }];
});
fastify.get("/", async () => {
  return { ok: true, status: "Smart Home Hub backend running" };
});

fastify.get("/health", async () => {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    tuya: Boolean(process.env.TUYA_ACCESS_ID && process.env.TUYA_ACCESS_SECRET && process.env.TUYA_ENDPOINT),
  };
});

// Safe env debug endpoint (no secret values)
fastify.get("/env-status", async () => {
  return {
    ok: true,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasTuya: Boolean(process.env.TUYA_ACCESS_ID && process.env.TUYA_ACCESS_SECRET && process.env.TUYA_ENDPOINT),
    tuyaEndpoint: process.env.TUYA_ENDPOINT || "",
  };
});

async function ensureGroceriesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS groceries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      is_done BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
}

await ensureGroceriesTable();

fastify.get("/weather", async (request, reply) => {
  try {
    // Bahrain (Manama) approx coords
    const lat = 26.2235;
    const lon = 50.5876;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`Weather failed (${res.status})`);
      const data = await res.json().catch(() => null);
      const tempC = Math.round(Number(data?.current?.temperature_2m));
      const code = Number(data?.current?.weather_code);

      // Minimal mapping
      let condition = "Clear";
      let icon = "sun";
      if ([1, 2, 3].includes(code)) {
        condition = "Cloudy";
        icon = "cloud";
      } else if ([45, 48].includes(code)) {
        condition = "Fog";
        icon = "cloud";
      } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
        condition = "Rain";
        icon = "rain";
      }

      return reply.send({ tempC, condition, icon, location: "Bahrain" });
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    request.log.error(e);
    // safe fallback
    return reply.send({ tempC: 24, condition: "Clear", icon: "sun", location: "Bahrain" });
  }
});

// ---- Groceries ----
fastify.get("/groceries", async (request, reply) => {
  try {
    const { rows } = await db.query("SELECT * FROM groceries ORDER BY id DESC");
    return reply.send(rows);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.post("/groceries", async (request, reply) => {
  try {
    const body = request.body || {};
    const title = typeof body.name === "string" ? body.name.trim() : typeof body.title === "string" ? body.title.trim() : "";
    const requestedBy = body.requestedBy === "abood" ? "abood" : "family";
    if (!title) return reply.code(400).send({ ok: false, error: "Invalid name" });
    const { rows } = await db.query(
      "INSERT INTO groceries (title, requested_by) VALUES ($1, $2) RETURNING *",
      [title, requestedBy]
    );
    return reply.send(rows[0]);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.patch("/groceries/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const body = request.body || {};
    const bought = body.bought;
    const name = typeof body.name === "string" ? body.name.trim() : typeof body.title === "string" ? body.title.trim() : "";

    const fields = [];
    const values = [];
    let i = 1;

    if (typeof bought === "boolean") {
      fields.push(`is_done = $${i++}`);
      values.push(bought);
    }
    if (name) {
      fields.push(`title = $${i++}`);
      values.push(name);
    }
    if (fields.length === 0) return reply.code(400).send({ ok: false, error: "Invalid body" });

    values.push(id);
    const { rows } = await db.query(
      `UPDATE groceries SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return reply.code(404).send({ ok: false, error: "Not found" });
    return reply.send(rows[0]);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.delete("/groceries/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await db.query("DELETE FROM groceries WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return reply.code(404).send({ ok: false, error: "Not found" });
    return reply.send({ ok: true });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.post("/scenes/:sceneId", async (request, reply) => {
  const { sceneId } = request.params;
  const scenes = {
    shower: {
      sceneName: "Shower Mode",
      emoji: "🚿",
      message: "Towel heaters ON for 45 minutes",
      duration_minutes: 45,
    },
    away: {
      sceneName: "Away Mode",
      emoji: "🚪",
      message: "Doors locked • Lights off",
      duration_minutes: null,
    },
    sleep: {
      sceneName: "Sleep Mode",
      emoji: "🌙",
      message: "Lights off • Quiet • AC off",
      duration_minutes: null,
    },
    gathering: {
      sceneName: "Gathering Mode",
      emoji: "🍷",
      message: "Let’s get ready!",
      duration_minutes: null,
    },
  };

  const id = typeof sceneId === "string" ? sceneId : "";
  const s = scenes[id];
  if (!s) {
    return reply.code(400).send({
      ok: false,
      error: "Unknown scene",
    });
  }

  // Shower Mode: stub success (devices unknown)
  if (id === "shower") {
    return reply.send({
      ok: true,
      sceneId: id,
      sceneName: s.sceneName,
      emoji: s.emoji,
      message: s.message,
      duration_minutes: s.duration_minutes,
      results: { stub: true },
    });
  }

  // Gathering Mode: no Tuya, create urgent tasks
  if (id === "gathering") {
    const body = request.body || {};
    const gatheringType = body.gatheringType;

    if (gatheringType !== "bahram" && gatheringType !== "haffadh" && gatheringType !== "friends") {
      return reply.code(400).send({ ok: false, error: "Invalid gatheringType" });
    }

    const aboodId = await findUserIdByName("Abood");
    const titlesByType = {
      bahram: [
        "Prepare living room for Bahram family",
        "Set tea, dates & snacks",
        "Check bathroom supplies",
      ],
      haffadh: [
        "Prepare living room for Haffadh family",
        "Set drinks & snacks",
        "Check bathroom supplies",
      ],
      friends: [
        "Prepare living room for friends",
        "Set drinks & snacks",
        "Check bathroom supplies",
      ],
    };
    const titles = titlesByType[gatheringType];

    const created = [];
    for (const title of titles) {
      try {
        const row = await createUrgentTask({ title, assigned_to: aboodId });
        created.push(row);
      } catch (e) {
        request.log.error(e);
      }
    }

    return reply.send({
      ok: true,
      sceneId: id,
      sceneName: s.sceneName,
      emoji: s.emoji,
      message: "Gathering Mode prepared",
      duration_minutes: s.duration_minutes,
      results: { gatheringType, created_urgent_tasks: created },
    });
  }

  // Away/Sleep: real Tuya turn-off
  const awayDeviceIds = [
    "bf764156746c04629ds53u",
    "bf7e312cdc1833bcd1vtwq",
    "bf5267cc9a40db55fdewu1",
  ];
  const sleepExtraDeviceIds = [
    "bf1b3f05e130f44ea0sy5w",
    "bf1cd69a2f640b4d5ewslp",
    "bf6b932ae27f7f2edeycd6",
  ];

  const deviceIds = id === "sleep" ? [...awayDeviceIds, ...sleepExtraDeviceIds] : awayDeviceIds;

  const settled = await Promise.allSettled(deviceIds.map((d) => turnOffIfOn(d)));
  const results = settled.map((r, idx) => {
    const deviceId = deviceIds[idx];
    if (r.status === "fulfilled") return r.value;
    const msg = r.reason instanceof Error ? r.reason.message : "Tuya error";
    return {
      deviceId,
      attempted: true,
      already_off: false,
      turned_off: false,
      offline: false,
      error: String(msg || "Tuya error"),
    };
  });

  const counts = {
    turned_off: results.filter((x) => x.turned_off).length,
    already_off: results.filter((x) => x.already_off).length,
    offline: results.filter((x) => x.offline).length,
    error: results.filter((x) => x.error).length,
  };

  const msgParts = [];
  if (counts.turned_off) msgParts.push(`${counts.turned_off} turned off`);
  if (counts.already_off) msgParts.push(`${counts.already_off} already off`);
  if (counts.offline) msgParts.push(`${counts.offline} offline`);
  if (counts.error) msgParts.push(`${counts.error} error`);
  const message = msgParts.length ? msgParts.join(" • ") : s.message;

  return reply.send({
    ok: true,
    sceneId: id,
    sceneName: s.sceneName,
    emoji: s.emoji,
    message,
    duration_minutes: s.duration_minutes,
    results,
  });
});

// ---- INTEGRATIONS (STUBS) ----
fastify.post("/integrations/tuya/trigger", async (request, reply) => {
  try {
    const body = request.body || {};
    const action = typeof body.action === "string" ? body.action : "";
    const payload = body.payload;

    // TODO: Wire Tuya/SmartLife SDK here (device discovery, scene trigger, etc.)
    return reply.send({ ok: true, action, payload, note: "Tuya integration stub" });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Tuya unavailable" });
  }
});

fastify.get("/integrations/tuya/status", async (request, reply) => {
  try {
    return reply.send({
      ok: true,
      connected: false,
      message: "Tuya integration not configured yet",
    });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Tuya unavailable" });
  }
});

fastify.post("/integrations/tuya/device/:deviceId/command", async (request, reply) => {
  try {
    const { deviceId } = request.params;
    const body = request.body || {};
    const command = typeof body.command === "string" ? body.command : "";
    const value = body.value;

    // TODO: Send device command via Tuya/SmartLife SDK.
    return reply.send({
      ok: true,
      sent: true,
      deviceId: String(deviceId || ""),
      command,
      value,
    });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Tuya unavailable" });
  }
});

// ---- AI (BACKEND PROXY) ----
fastify.post("/ai/howto", async (request, reply) => {
  try {
    const body = request.body || {};
    const title = body.title;
    const context = body.context;
    const type = body.type;

    if (typeof title !== "string" || !title.trim()) {
      return reply.code(400).send({ ok: false, error: "Invalid request" });
    }

    const result = await generateHowToAnswer({ title, context, type });
    if (result?.ok === true && typeof result.answer === "string" && result.answer.trim()) {
      return reply.code(200).send({ ok: true, answer: result.answer.trim() });
    }

    // Log required fields when OpenAI fails
    request.log.error(
      {
        httpStatus: result?.status ?? null,
        message: typeof result?.detail === "string" ? result.detail : "",
        "error.type": result?.type ?? null,
        "error.code": result?.code ?? null,
      },
      "OpenAI failed"
    );

    const kind =
      result?.error === "OPENAI_NO_CREDITS"
        ? "NO_CREDITS"
        : result?.error === "OPENAI_INVALID_KEY"
          ? "INVALID_KEY"
          : result?.error === "OPENAI_ENV_MISSING"
            ? "ENV_MISSING"
            : "OPENAI_ERROR";
    const detail = typeof result?.detail === "string" && result.detail.trim() ? result.detail.trim() : "OpenAI request failed";

    return reply.code(500).send({ ok: false, error: "OPENAI_ERROR", detail: `${kind}: ${detail}`.slice(0, 240) });
  } catch (e) {
    request.log.error(e);
    const msg = e instanceof Error ? e.message : "OpenAI request failed";
    return reply.code(500).send({ ok: false, error: "OPENAI_ERROR", detail: `OPENAI_ERROR: ${String(msg).slice(0, 220)}` });
  }
});

// GET variant for debugging / quick test
fastify.get("/ai/howto", async (request, reply) => {
  try {
    const { taskTitle, context } = request.query || {};
    const title = typeof taskTitle === "string" ? taskTitle : "";
    const ctx = typeof context === "string" ? context : "";
    if (!title.trim()) return reply.code(400).send({ ok: false, error: "Invalid request" });

    const result = await generateHowToAnswer({ title, context: ctx, type: "task" });
    if (result?.ok === true && typeof result.answer === "string" && result.answer.trim()) {
      return reply.code(200).send({ ok: true, answer: result.answer.trim() });
    }
    const kind =
      result?.error === "OPENAI_NO_CREDITS"
        ? "NO_CREDITS"
        : result?.error === "OPENAI_INVALID_KEY"
          ? "INVALID_KEY"
          : result?.error === "OPENAI_ENV_MISSING"
            ? "ENV_MISSING"
            : "OPENAI_ERROR";
    const detail = typeof result?.detail === "string" && result.detail.trim() ? result.detail.trim() : "OpenAI request failed";
    return reply.code(500).send({ ok: false, error: "OPENAI_ERROR", detail: `${kind}: ${detail}`.slice(0, 240) });
  } catch (e) {
    request.log.error(e);
    const msg = e instanceof Error ? e.message : "OpenAI request failed";
    return reply.code(500).send({ ok: false, error: "OPENAI_ERROR", detail: `OPENAI_ERROR: ${String(msg).slice(0, 220)}` });
  }
});

async function deviceSwitchHandler(request, reply) {
  try {
    const { deviceId } = request.params;
    const body = request.body || {};
    const on = body.on;

    if (!deviceId || typeof deviceId !== "string") {
      return reply.code(400).send({ ok: false, error: "deviceId required" });
    }
    if (typeof on !== "boolean") {
      return reply.code(400).send({ ok: false, error: "on must be boolean" });
    }

    request.log.info({ deviceId, payload: { on } }, "Tuya switch request");

    const tuyaResponse = await setDeviceSwitch(deviceId, on);
    request.log.info({ deviceId, tuyaResponse }, "Tuya switch response");

    if (!tuyaResponse || tuyaResponse.ok !== true) {
      const detail = typeof tuyaResponse?.error === "string" ? tuyaResponse.error : "Tuya command failed";
      return reply
        .code(500)
        .send({ ok: false, error: "TUYA_COMMAND_FAILED", detail: String(detail).slice(0, 220) });
    }

    return reply.send({ ok: true, deviceId, on, tuyaResponse });
  } catch (e) {
    request.log.error(e);
    const msg = e instanceof Error ? e.message : "Tuya error";
    return reply.code(500).send({ ok: false, error: "TUYA_COMMAND_FAILED", detail: String(msg || "Tuya error").slice(0, 220) });
  }
}
console.log("✅ /devices route hit");
fastify.get("/devices", async (request, reply) => {
  try {
    const devices = await getDevices();

    // Optional: filter only to your known devices from .env
    const raw = process.env.TUYA_DEVICE_IDS || "";
    const allowIds = raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const filtered = allowIds.length
      ? devices.filter((d) => allowIds.includes(d.id))
      : devices;

    return reply.send({ ok: true, devices: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tuya error";
    return reply.code(500).send({ ok: false, error: String(msg) });
  }
});
fastify.post("/devices/:deviceId/toggle", deviceSwitchHandler);
fastify.post("/devices/:deviceId/switch", deviceSwitchHandler);

// ---- TUYA (PHASE 1 REAL CLIENT) ----
// (Deprecated) older /tuya routes removed in favor of /devices
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

await fastify.register(fastifyStatic, {
  root: __dirname,
})


// ---- USERS ----

fastify.post('/users', async (request) => {
    const { name, role } = request.body
    console.log("User created ✅", { name, role });
    const { rows } = await db.query(
      'INSERT INTO users (name, role) VALUES ($1, $2) RETURNING *',
      [name, role]
    )
  
    return rows[0]
  })
// ---- TASKS ----

fastify.post('/tasks', async (request) => {
    const { title, assigned_to, day_of_week } = request.body
  
    const { rows } = await db.query(
      `INSERT INTO tasks (title, assigned_to, day_of_week)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, assigned_to, day_of_week]
    )
  
    return rows[0]
  })
  fastify.get('/tasks/today/:userId', async (request) => {
    const { userId } = request.params
    const today = new Date().getDay()
  
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2',
      [userId, today]
    )
  
    return rows
  })
  fastify.get('/tasks/assigned/:userId', async (request) => {
    const { userId } = request.params
  
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY id DESC',
      [userId]
    )
  
    return rows
  })
  fastify.get('/tasks', async () => {
    const { rows } = await db.query('SELECT * FROM tasks ORDER BY id DESC')
    return rows
  })
  // ---- URGENT TASKS ----

// Create urgent task
fastify.post("/urgent_tasks", async (request, reply) => {
  try {
    const body = request.body || {};
    const title = body.title;
    let assigned_to = body.assigned_to;
    const assigned_to_name = body.assigned_to_name;

    if ((assigned_to == null || assigned_to === "") && typeof assigned_to_name === "string" && assigned_to_name.trim()) {
      assigned_to = await findUserIdByName(assigned_to_name.trim());
    }
    const row = await createUrgentTask({ title, assigned_to });
    return reply.send(row);
  } catch (e) {
    request.log.error(e);
    return reply.code(400).send({ ok: false, error: "Invalid urgent task" });
  }
});
// GET all urgent tasks
fastify.get("/urgent_tasks", async () => {
  const { rows } = await db.query(
    "SELECT * FROM urgent_tasks ORDER BY id DESC"
  );
  return rows;
});

// Get urgent tasks by user
fastify.get('/urgent_tasks/:userId', async (request) => {
  const { userId } = request.params

  const { rows } = await db.query(
    `
    SELECT * FROM urgent_tasks
    WHERE assigned_to = $1
    ORDER BY id DESC
    `,
    [userId]
  )

  return rows
})
// Get today's tasks
fastify.get("/tasks/today", async (request, reply) => {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  const { rows } = await db.query(
    "SELECT * FROM tasks WHERE day_of_week = $1 ORDER BY id DESC",
    [day]
  );

  return rows;
});
// Acknowledge urgent task
fastify.patch('/urgent_tasks/:id/ack', async (request) => {
  const { id } = request.params

  const { rows } = await db.query(
    `
    UPDATE urgent_tasks
    SET acknowledged = true
    WHERE id = $1
    RETURNING *
    `,
    [id]
  )

  return rows[0]
})
fastify.get('/today/:userId', async (request) => {
  const { userId } = request.params
  const today = new Date().getDay()

  const urgent = await db.query(
    `SELECT * FROM urgent_tasks
     WHERE assigned_to = $1 AND acknowledged = false
     ORDER BY id DESC`,
    [userId]
  )

  const normal = await db.query(
    `SELECT * FROM tasks
     WHERE assigned_to = $1 AND day_of_week = $2
     ORDER BY id DESC`,
    [userId, today]
  )

  return {
    urgent: urgent.rows,
    tasks: normal.rows,
  }
})
fastify.patch("/urgent_tasks/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const body = request.body || {};

    const fields = [];
    const values = [];
    let i = 1;

    if (typeof body.acknowledged === "boolean") {
      fields.push(`acknowledged = $${i++}`);
      values.push(body.acknowledged);
    }
    if (typeof body.title === "string" && body.title.trim()) {
      fields.push(`title = $${i++}`);
      values.push(body.title.trim());
    }

    if (fields.length === 0) {
      return reply.code(400).send({ ok: false, error: "Invalid body" });
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE urgent_tasks SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return reply.code(404).send({ ok: false, error: "Urgent task not found" });
    return reply.send(rows[0]);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});
fastify.patch("/tasks/:taskId/toggle", async (request, reply) => {
  const { taskId } = request.params;

  const result = await db.query(
    `
    UPDATE tasks
    SET is_done = NOT is_done
    WHERE id = $1
    RETURNING *
    `,
    [taskId]
  );

  if (result.rows.length === 0) {
    return reply.code(404).send({ error: "Task not found" });
  }

  return reply.send(result.rows[0]);
});

// Match frontend PATCH /tasks/:id usage
fastify.patch("/tasks/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const body = request.body || {};
    const fields = [];
    const values = [];
    let i = 1;

    if (typeof body.is_done === "boolean") {
      fields.push(`is_done = $${i++}`);
      values.push(body.is_done);
    }
    if (typeof body.title === "string" && body.title.trim()) {
      fields.push(`title = $${i++}`);
      values.push(body.title.trim());
    }

    if (fields.length === 0) {
      return reply.code(400).send({ ok: false, error: "Invalid body" });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return reply.code(404).send({ ok: false, error: "Task not found" });
    return reply.send(result.rows[0]);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.delete("/tasks/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return reply.code(404).send({ ok: false, error: "Task not found" });
    return reply.send({ ok: true });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.delete("/urgent_tasks/:id", async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await db.query("DELETE FROM urgent_tasks WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return reply.code(404).send({ ok: false, error: "Urgent task not found" });
    return reply.send({ ok: true });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ ok: false, error: "Server error" });
  }
});

fastify.listen({ port: Number(process.env.PORT) || 3001 }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
