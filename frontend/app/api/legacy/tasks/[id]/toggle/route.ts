import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/legacy/tasks/[id]/toggle
 * Toggle is_done on a legacy task.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;

    const db = getDb();

    // Fetch current state
    const { data: current, error: fetchErr } = await db
      .from("tasks")
      .select("is_done")
      .eq("id", id)
      .single();

    if (fetchErr) throw fetchErr;
    if (!current) {
      return errorResponse(404, "Task not found");
    }

    // Toggle
    const { data, error } = await db
      .from("tasks")
      .update({ is_done: !current.is_done })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
