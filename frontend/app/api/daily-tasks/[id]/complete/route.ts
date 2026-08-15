import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { completeInstance } from "@/lib/server/services/dailyTasksDb";
import { STAFF_PANEL_ROLES } from "@/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/daily-tasks/[id]/complete
 * Mark a daily task instance as done for a given date.
 *
 * Staff + admin only. These are one person's tasks and only that person (or
 * the admin checking his panel) marks them off; a family member's token gets
 * 403 whether it arrives from the panel or from a hand-rolled request.
 */
export async function POST(request: Request, { params }: RouteParams) {
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
    const { searchParams } = new URL(request.url);
    const date =
      (body.date ? String(body.date) : null) ||
      searchParams.get("date") ||
      new Date().toISOString().slice(0, 10);

    const data = await completeInstance(taskId, date);

    if (!data) {
      return errorResponse(404, "Task not found or invalid date");
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
