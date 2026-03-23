import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

/**
 * GET /api/legacy/tasks/today
 * List legacy tasks for the current day of week.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const currentDayOfWeek = new Date().getDay();

    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .eq("day_of_week", currentDayOfWeek)
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
