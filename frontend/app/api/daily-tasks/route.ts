import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
  getActor,
} from "@/lib/server/middleware";
import { logActivity } from "@/lib/server/activityLog";
import {
  getTasksWithInstances,
  createDailyTask,
} from "@/lib/server/services/dailyTasksDb";

/**
 * GET /api/daily-tasks?staff_user_id=&date=
 * Get daily tasks with materialized instances for a staff user and date.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const staffUserId = parseInt(searchParams.get("staff_user_id") || "", 10);

    if (isNaN(staffUserId)) {
      return errorResponse(400, "staff_user_id is required (integer)");
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = searchParams.get("date") || today;

    const result = await getTasksWithInstances(staffUserId, date);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/daily-tasks
 * Create a new daily task.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);

    if (!body.title) {
      return errorResponse(400, "title is required");
    }

    // Validate times
    const timeRe = /^\d{2}:\d{2}$/;
    if (body.window_start && !timeRe.test(String(body.window_start))) {
      return errorResponse(400, "window_start must be HH:MM format");
    }
    if (body.window_end && !timeRe.test(String(body.window_end))) {
      return errorResponse(400, "window_end must be HH:MM format");
    }

    // Validate start_date
    if (body.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.start_date))) {
      return errorResponse(400, "start_date must be YYYY-MM-DD format");
    }

    // Validate recurrence
    const validRecurrences = ["none", "daily", "weekly", "monthly", "custom"];
    if (body.recurrence && !validRecurrences.includes(String(body.recurrence))) {
      return errorResponse(400, `recurrence must be one of: ${validRecurrences.join(", ")}`);
    }

    const payload = {
      staff_user_id: body.staff_user_id ?? 1,
      title: String(body.title),
      notes: body.notes ?? "",
      window_start: body.window_start ?? "08:00",
      window_end: body.window_end ?? "12:00",
      timezone: body.timezone ?? "Asia/Bahrain",
      recurrence: body.recurrence ?? "none",
      recurrence_days: body.recurrence_days || null,
      recurrence_day_of_month: body.recurrence_day_of_month ?? null,
      recurrence_interval: body.recurrence_interval ?? null,
      start_date: body.start_date || new Date().toISOString().slice(0, 10),
      end_date: body.end_date || null,
      room: body.room ?? null,
      assigned_by: body.assigned_by ?? null,
      category: body.category ?? "misc",
    };

    const data = await createDailyTask(payload);

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "daily_task_create",
      entity_type: "daily_task",
      entity_id: String(data.id),
      payload_json: { title: payload.title },
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
