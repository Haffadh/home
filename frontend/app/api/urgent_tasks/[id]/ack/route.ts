import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
  getActor,
} from "@/lib/server/middleware";
import { logActivity } from "@/lib/server/activityLog";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/urgent_tasks/[id]/ack
 * Mark an urgent task as seen.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .update({ seen: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const actor = getActor(request);
    await logActivity({
      ...actor,
      action: "seen",
      entity_type: "urgent_task",
      entity_id: id,
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
