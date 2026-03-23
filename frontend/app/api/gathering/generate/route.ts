import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { authenticateRequest, isAuthError, parseBody, errorResponse, getActor } from "@/lib/server/middleware";
import { logActivity } from "@/lib/server/activityLog";
import crypto from "crypto";

const TASK_TIME_WINDOWS: Record<string, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "22:00" },
};

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

function getSlotBounds(dateStr: string, windowKey: string) {
  const w = TASK_TIME_WINDOWS[windowKey];
  if (!w) return null;
  const [sh, sm] = w.start.split(":").map(Number);
  const [eh, em] = w.end.split(":").map(Number);
  return {
    start: new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`),
    end: new Date(`${dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`),
  };
}

type NormTask = { startTime: string; endTime: string };

export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const body = await parseBody(request);
  const db = getDb();

  const gatheringType = typeof body.gatheringType === "string" ? body.gatheringType : "";
  if (!["lunch", "dinner", "casual_evening", "other"].includes(gatheringType)) {
    return errorResponse(400, "gatheringType must be one of: lunch, dinner, casual_evening, other");
  }
  const date = typeof body.date === "string" ? (body.date as string).trim().slice(0, 10) : "";
  const time = typeof body.time === "string" ? (body.time as string).trim().slice(0, 5) : "18:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse(400, "date required (YYYY-MM-DD)");

  const gid = (body.gatheringId as string) || crypto.randomUUID();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date); eventDay.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((eventDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const isLunch = gatheringType === "lunch";

  const room45 = ROOM_PREP_45.map((title) => ({ title, duration: 45, category: "room" }));
  const room60 = ROOM_PREP_60.map((title) => ({ title, duration: 60, category: "room" }));
  const driveway = daysUntil >= 7 ? [{ title: "Driveway", category: "room", duration: DRIVEWAY_DURATION }] : [];
  const gateTask = { title: "Keep the gate open", category: "hosting", duration: 10, time: isLunch ? "14:00" : "19:00", date };

  const prepTasks = [...room45, ...room60, ...driveway, ...OTHER_TASKS];
  const created: Record<string, unknown>[] = [];

  const { data: existingTasks } = await db.from("scheduled_tasks").select("id, date, start_time, end_time");
  const allTracked: NormTask[] = (existingTasks || []).map((t: Record<string, unknown>) => ({
    startTime: t.start_time as string,
    endTime: t.end_time as string,
  }));

  function findSlot(dateStr: string, windowKey: string, duration: number): { start: string; end: string } | null {
    const bounds = getSlotBounds(dateStr, windowKey);
    if (!bounds) return null;
    let cursor = bounds.start.getTime();
    const endTs = bounds.end.getTime();
    while (cursor + duration * 60 * 1000 <= endTs) {
      const overlaps = allTracked.some((t) =>
        cursor < new Date(t.endTime).getTime() && cursor + duration * 60 * 1000 > new Date(t.startTime).getTime()
      );
      if (!overlaps) {
        return { start: new Date(cursor).toISOString(), end: new Date(cursor + duration * 60 * 1000).toISOString() };
      }
      cursor += duration * 60 * 1000;
    }
    return null;
  }

  const windows = ["morning", "afternoon", "evening"];

  if (daysUntil <= 1) {
    const todayStr = today.toISOString().slice(0, 10);
    for (const t of prepTasks) {
      for (const w of windows) {
        const slot = findSlot(todayStr, w, t.duration);
        if (slot) {
          const task = { id: crypto.randomUUID(), title: t.title, date: todayStr, start_time: slot.start, end_time: slot.end, duration_minutes: t.duration, status: "pending", category: t.category, gathering_id: gid, is_auto_generated: true };
          created.push(task);
          allTracked.push({ startTime: slot.start, endTime: slot.end });
          break;
        }
      }
    }
  } else {
    const availableDays: string[] = [];
    for (let d = 1; d < daysUntil; d++) { const s = new Date(today); s.setDate(s.getDate() + d); availableDays.push(s.toISOString().slice(0, 10)); }
    let taskIdx = 0;
    outer: for (const dateStr of availableDays) {
      for (const w of windows) {
        while (taskIdx < prepTasks.length) {
          const slot = findSlot(dateStr, w, prepTasks[taskIdx].duration);
          if (slot) {
            const t = prepTasks[taskIdx];
            created.push({ id: crypto.randomUUID(), title: t.title, date: dateStr, start_time: slot.start, end_time: slot.end, duration_minutes: t.duration, status: "pending", category: t.category, gathering_id: gid, is_auto_generated: true });
            allTracked.push({ startTime: slot.start, endTime: slot.end });
            taskIdx++;
            continue;
          }
          break;
        }
        if (taskIdx >= prepTasks.length) break outer;
      }
    }
  }

  // Fixed-time gate task
  const gateStart = `${gateTask.date}T${gateTask.time}:00`;
  const gateEnd = new Date(new Date(gateStart).getTime() + gateTask.duration * 60 * 1000).toISOString();
  created.push({ id: crypto.randomUUID(), title: gateTask.title, date: gateTask.date, start_time: gateStart, end_time: gateEnd, duration_minutes: gateTask.duration, status: "pending", category: gateTask.category, gathering_id: gid, is_auto_generated: true });

  if (created.length > 0) await db.from("scheduled_tasks").insert(created);

  const actor = getActor(request, body);
  await logActivity({ ...actor, action: "created", entity_type: "task", entity_id: null, payload_json: { gatheringType, count: created.length } });

  const tasks = created.map((t) => ({ id: t.id, title: t.title, date: t.date, startTime: t.start_time, endTime: t.end_time, durationMinutes: t.duration_minutes, status: t.status, category: t.category, gatheringId: t.gathering_id, isAutoGenerated: t.is_auto_generated }));
  return NextResponse.json({ ok: true, gatheringId: gid, tasks, created: tasks });
}
