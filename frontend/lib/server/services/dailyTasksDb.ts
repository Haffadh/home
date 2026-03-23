/**
 * Daily tasks DB layer: materialize instances and CRUD.
 * Ported from backend/lib/dailyTasksDb.js — uses Supabase query builder.
 */

import { getDb } from "../db";

function parseDateOnly(str: unknown): string | null {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : str;
}

function dayOfWeekForDate(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

export async function ensureInstancesForDate(staffUserId: number, dateStr: string) {
  const date = parseDateOnly(dateStr);
  if (!date) return;
  const db = getDb();

  const { data: tasks } = await db
    .from("daily_tasks")
    .select("id, recurrence, recurrence_days, start_date, end_date, recurrence_day_of_month, recurrence_interval")
    .eq("staff_user_id", staffUserId)
    .eq("is_active", true)
    .lte("start_date", date)
    .or(`end_date.is.null,end_date.gte.${date}`);

  if (!tasks || tasks.length === 0) return;
  const day = dayOfWeekForDate(date);

  for (const t of tasks) {
    let shouldHave = false;
    if (t.recurrence === "none") shouldHave = t.start_date === date;
    else if (t.recurrence === "daily") shouldHave = true;
    else if (t.recurrence === "weekly" && Array.isArray(t.recurrence_days)) shouldHave = t.recurrence_days.includes(day);
    else if (t.recurrence === "monthly" && t.recurrence_day_of_month) {
      shouldHave = new Date(date + "T12:00:00Z").getUTCDate() === t.recurrence_day_of_month;
    } else if (t.recurrence === "custom" && t.recurrence_interval > 0) {
      const startMs = new Date(t.start_date + "T12:00:00Z").getTime();
      const dateMs = new Date(date + "T12:00:00Z").getTime();
      const daysDiff = Math.round((dateMs - startMs) / (24 * 60 * 60 * 1000));
      shouldHave = daysDiff >= 0 && daysDiff % t.recurrence_interval === 0;
    }

    if (!shouldHave) continue;

    await db.from("daily_task_instances").upsert(
      { task_id: t.id, due_date: date, status: "pending" },
      { onConflict: "task_id,due_date", ignoreDuplicates: true }
    );
  }
}

export async function getTasksWithInstances(staffUserId: number, dateStr: string) {
  const date = parseDateOnly(dateStr);
  if (!date) return { tasks: [], staffUserId, date: null };

  await ensureInstancesForDate(staffUserId, dateStr);
  const db = getDb();

  const { data: tasks } = await db
    .from("daily_tasks")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .eq("is_active", true)
    .lte("start_date", date)
    .or(`end_date.is.null,end_date.gte.${date}`)
    .order("window_start")
    .order("id");

  if (!tasks || tasks.length === 0) return { tasks: [], staffUserId, date };

  const day = dayOfWeekForDate(date);
  const taskIds = tasks.map((t: Record<string, unknown>) => t.id);

  const { data: instances } = await db
    .from("daily_task_instances")
    .select("*")
    .in("task_id", taskIds)
    .eq("due_date", date);

  const instanceByTaskId: Record<string, unknown> = {};
  for (const i of instances || []) instanceByTaskId[(i as Record<string, unknown>).task_id as string] = i;

  const filtered = tasks.filter((t: Record<string, unknown>) => {
    if (t.recurrence === "none") return t.start_date === date;
    if (t.recurrence === "daily") return true;
    if (t.recurrence === "weekly" && Array.isArray(t.recurrence_days)) return t.recurrence_days.includes(day);
    if (t.recurrence === "monthly" && t.recurrence_day_of_month) {
      return new Date(date + "T12:00:00Z").getUTCDate() === (t.recurrence_day_of_month as number);
    }
    if (t.recurrence === "custom" && (t.recurrence_interval as number) > 0) {
      const startMs = new Date(t.start_date + "T12:00:00Z").getTime();
      const dateMs = new Date(date + "T12:00:00Z").getTime();
      const daysDiff = Math.round((dateMs - startMs) / (24 * 60 * 60 * 1000));
      return daysDiff >= 0 && daysDiff % (t.recurrence_interval as number) === 0;
    }
    return false;
  });

  return {
    tasks: filtered.map((t: Record<string, unknown>) => ({ ...t, instance: instanceByTaskId[t.id as string] || null })),
    staffUserId,
    date,
  };
}

export async function createDailyTask(payload: Record<string, unknown>) {
  const db = getDb();
  const { data, error } = await db.from("daily_tasks").insert({
    staff_user_id: payload.staff_user_id ?? 1,
    title: payload.title,
    notes: payload.notes ?? "",
    window_start: payload.window_start ?? "08:00",
    window_end: payload.window_end ?? "12:00",
    timezone: payload.timezone ?? "Asia/Bahrain",
    recurrence: payload.recurrence ?? "none",
    recurrence_days: payload.recurrence_days || null,
    recurrence_day_of_month: payload.recurrence_day_of_month ?? null,
    recurrence_interval: payload.recurrence_interval ?? null,
    start_date: payload.start_date,
    end_date: payload.end_date || null,
    room: payload.room ?? null,
    assigned_by: payload.assigned_by ?? null,
    category: payload.category ?? "misc",
    is_active: true,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDailyTask(id: number, payload: Record<string, unknown>) {
  const db = getDb();
  const patch: Record<string, unknown> = {};
  const allowed = ["title", "notes", "window_start", "window_end", "timezone", "recurrence", "recurrence_days", "start_date", "end_date", "is_active"];
  for (const key of allowed) {
    if (!(key in payload)) continue;
    patch[key] = payload[key];
  }
  if (Object.keys(patch).length === 0) return null;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await db.from("daily_tasks").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function completeInstance(taskId: number, dateStr: string) {
  const date = parseDateOnly(dateStr);
  if (!date) return null;
  const db = getDb();

  // Get task to find staff_user_id
  const { data: task } = await db.from("daily_tasks").select("*").eq("id", taskId).single();
  if (!task) return null;
  await ensureInstancesForDate(task.staff_user_id, date);

  const { data, error } = await db
    .from("daily_task_instances")
    .upsert(
      { task_id: taskId, due_date: date, status: "done", completed_at: new Date().toISOString() },
      { onConflict: "task_id,due_date" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function skipInstance(taskId: number, dateStr: string) {
  const date = parseDateOnly(dateStr);
  if (!date) return null;
  const db = getDb();

  const { data: task } = await db.from("daily_tasks").select("*").eq("id", taskId).single();
  if (!task) return null;
  await ensureInstancesForDate(task.staff_user_id, date);

  const { data, error } = await db
    .from("daily_task_instances")
    .upsert(
      { task_id: taskId, due_date: date, status: "skipped" },
      { onConflict: "task_id,due_date" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
