import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { updateDailyTask } from "@/lib/server/services/dailyTasksDb";
import { STAFF_PANEL_ROLES } from "@/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/daily-tasks/[id]
 * Update a daily task. Staff + admin only — `is_active: false` here is the
 * admin panel's soft delete, so it is not a family member's to call.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRole(auth, ...STAFF_PANEL_ROLES);
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return errorResponse(400, "Invalid task id");
    }

    const body = await parseBody(request);
    const payload: Record<string, unknown> = {};

    const allowed = [
      "title",
      "notes",
      "window_start",
      "window_end",
      "timezone",
      "recurrence",
      "recurrence_days",
      "start_date",
      "end_date",
      "is_active",
    ];

    for (const key of allowed) {
      if (key in body) {
        payload[key] = body[key];
      }
    }

    const data = await updateDailyTask(taskId, payload);

    if (data === null) {
      return errorResponse(400, "No valid fields to update");
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
