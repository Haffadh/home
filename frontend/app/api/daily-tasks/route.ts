import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  parseBody,
  errorResponse,
  getActor,
} from "@/lib/server/middleware";
import { STAFF_PANEL_ROLES } from "@/lib/roles";
import { logActivity } from "@/lib/server/activityLog";
import {
  getTasksWithInstances,
  createDailyTask,
} from "@/lib/server/services/dailyTasksDb";
import { getStaffUserId } from "@/lib/server/services/staffUser";

/**
 * GET /api/daily-tasks?date=&staff_user_id=
 * Get daily tasks with materialized instances for a staff user and date.
 *
 * `staff_user_id` is optional and rarely wanted: omit it and the server
 * resolves the staff user by role, which is what every surface should do.
 * Passing the signed-in user's id is what made the staff panel render an
 * empty list for anyone who was not Abdullah.
 *
 * Staff + admin only. Its two readers are the staff panel and the admin task
 * list; the wall dashboard does not come through here at all — it calls the
 * same service directly behind its device token.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRole(auth, ...STAFF_PANEL_ROLES);
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("staff_user_id");
    const staffUserId = requested
      ? parseInt(requested, 10)
      : await getStaffUserId();

    if (staffUserId === null || Number.isNaN(staffUserId)) {
      return errorResponse(400, "No staff user exists to list tasks for");
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
 * Create a new daily task. Staff + admin only — assigning work to the
 * household staff is the admin panel's job.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRole(auth, ...STAFF_PANEL_ROLES);
  if (forbidden) return forbidden;

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

    /* Resolved server-side when the caller does not say. The admin panel used
       to have to fetch /users first just to learn this id, which left its
       "Add task" button dead for the ~5s that took — a click in that window
       did nothing at all, with no error. It no longer needs to know. */
    const staffUserId = body.staff_user_id ?? (await getStaffUserId());
    if (staffUserId === null) {
      return errorResponse(400, "No staff user exists to assign this task to");
    }

    const payload = {
      staff_user_id: staffUserId,
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
