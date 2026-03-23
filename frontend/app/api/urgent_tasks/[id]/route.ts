import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
  getActor,
} from "@/lib/server/middleware";
import { logActivity } from "@/lib/server/activityLog";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/urgent_tasks/[id]
 * Get urgent tasks assigned to a user (id = userId).
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .select("*")
      .eq("assigned_to", id)
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * PATCH /api/urgent_tasks/[id]
 * Update an urgent task (acknowledged, title).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await parseBody(request);
    const patch: Record<string, unknown> = {};

    if ("acknowledged" in body) patch.acknowledged = body.acknowledged === true;
    if ("title" in body && body.title) patch.title = String(body.title);

    if (Object.keys(patch).length === 0) {
      return errorResponse(400, "No valid fields to update");
    }

    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "urgent_task_update",
      entity_type: "urgent_task",
      entity_id: id,
      payload_json: patch,
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * DELETE /api/urgent_tasks/[id]
 * Delete an urgent task.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const db = getDb();
    const { error } = await db
      .from("urgent_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;

    const actor = getActor(request);
    await logActivity({
      ...actor,
      action: "urgent_task_delete",
      entity_type: "urgent_task",
      entity_id: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
