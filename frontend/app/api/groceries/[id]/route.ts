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

/**
 * PATCH /api/groceries/[id]
 * Update a grocery item (title and/or bought status).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await parseBody(request);

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.bought !== undefined) patch.is_done = body.bought === true;

    if (Object.keys(patch).length === 0) {
      return errorResponse(400, "No fields to update");
    }

    const db = getDb();
    const { data, error } = await db
      .from("groceries")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return errorResponse(404, "Grocery item not found");

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "grocery_update",
      entity_type: "grocery",
      entity_id: String(id),
      payload_json: patch,
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * DELETE /api/groceries/[id]
 * Delete a grocery item.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;

    const db = getDb();
    const { error } = await db
      .from("groceries")
      .delete()
      .eq("id", id);

    if (error) throw error;

    const actor = getActor(request);
    await logActivity({
      ...actor,
      action: "grocery_delete",
      entity_type: "grocery",
      entity_id: String(id),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
