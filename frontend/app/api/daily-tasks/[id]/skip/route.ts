import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { skipInstance } from "@/lib/server/services/dailyTasksDb";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/daily-tasks/[id]/skip
 * Mark a daily task instance as skipped for a given date.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

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

    const data = await skipInstance(taskId, date);

    if (!data) {
      return errorResponse(404, "Task not found or invalid date");
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
