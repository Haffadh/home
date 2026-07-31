import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  errorResponse,
  getActor,
} from "@/lib/server/middleware";
import { logActivity } from "@/lib/server/activityLog";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/requests/[id]/done
 * Abdullah (or admin) marks a family request handled. Family members get 403.
 * acknowledged is kept in sync so legacy readers of that column stay correct.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRole(auth, "abdullah", "admin");
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .update({ status: "done", acknowledged: true })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return errorResponse(404, "Request not found");

    const actor = getActor(request);
    await logActivity({
      ...actor,
      action: "request_done",
      entity_type: "urgent_task",
      entity_id: id,
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
