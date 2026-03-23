import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

type RouteParams = { params: Promise<{ userId: string }> };

/**
 * GET /api/today/[userId]
 * Get urgent tasks and today's legacy tasks for a user.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { userId } = await params;
    const currentDayOfWeek = new Date().getDay();
    const db = getDb();

    // Fetch urgent tasks (unacknowledged)
    const { data: urgent, error: urgentErr } = await db
      .from("urgent_tasks")
      .select("*")
      .eq("assigned_to", userId)
      .eq("acknowledged", false);

    if (urgentErr) throw urgentErr;

    // Fetch today's legacy tasks
    const { data: tasks, error: tasksErr } = await db
      .from("tasks")
      .select("*")
      .eq("assigned_to", userId)
      .eq("day_of_week", currentDayOfWeek);

    if (tasksErr) throw tasksErr;

    return NextResponse.json({
      urgent: urgent || [],
      tasks: tasks || [],
    });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
