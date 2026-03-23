import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

type RouteParams = { params: Promise<{ userId: string }> };

/**
 * GET /api/legacy/tasks/today/[userId]
 * List legacy tasks for a user on the current day of week.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { userId } = await params;
    const currentDayOfWeek = new Date().getDay();

    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .eq("assigned_to", userId)
      .eq("day_of_week", currentDayOfWeek);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
