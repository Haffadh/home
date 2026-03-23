import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, getActor, errorResponse } from "@/lib/server/middleware";
import { getDb } from "@/lib/server/db";
import { logActivity } from "@/lib/server/activityLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await parseBody(request);

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.category === "string") updates.category = body.category;
  if (typeof body.quantity === "number") updates.quantity = body.quantity;
  if (typeof body.unit === "string") updates.unit = body.unit;
  if (body.expiration_date !== undefined) updates.expiration_date = body.expiration_date;
  if (typeof body.threshold === "number") updates.threshold = body.threshold;
  if (body.location !== undefined) updates.location = body.location;
  if (body.default_location !== undefined) updates.default_location = body.default_location;

  if (Object.keys(updates).length === 0) {
    return errorResponse(400, "No fields to update");
  }

  try {
    const db = getDb();
    const { data: item, error } = await db
      .from("inventory")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!item) return errorResponse(404, "Inventory item not found");

    const { actor_role, actor_name } = getActor(request, body);
    await logActivity({
      actor_role,
      actor_name,
      action: "updated",
      entity_type: "inventory",
      entity_id: id,
      payload_json: updates,
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to update inventory item");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  try {
    const db = getDb();
    const { error } = await db.from("inventory").delete().eq("id", id);

    if (error) throw error;

    const { actor_role, actor_name } = getActor(request);
    await logActivity({
      actor_role,
      actor_name,
      action: "deleted",
      entity_type: "inventory",
      entity_id: id,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to delete inventory item");
  }
}
