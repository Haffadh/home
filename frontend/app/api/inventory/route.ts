import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, getActor, errorResponse } from "@/lib/server/middleware";
import { getDb } from "@/lib/server/db";
import { logActivity } from "@/lib/server/activityLog";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data: items, error } = await db
      .from("inventory")
      .select("*")
      .order("category")
      .order("name");

    if (error) throw error;

    return NextResponse.json({ ok: true, items: items || [] });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to fetch inventory");
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await parseBody(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return errorResponse(400, "name is required");
  }

  const category = typeof body.category === "string" ? body.category : "other";
  const quantity = typeof body.quantity === "number" ? body.quantity : 1;
  const unit = typeof body.unit === "string" ? body.unit : "pcs";
  const expiration_date = (body.expiration_date || body.expiry_date || null) as string | null;
  const threshold = typeof body.threshold === "number" ? body.threshold : null;
  const location = typeof body.location === "string" ? body.location : null;
  const default_location = typeof body.default_location === "string" ? body.default_location : null;

  try {
    const db = getDb();

    // Check for duplicate by name (case-insensitive)
    const { data: existing } = await db
      .from("inventory")
      .select("*")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    let item;

    if (existing) {
      // Merge: add quantities and update other fields
      const newQuantity = (existing.quantity || 0) + quantity;
      const updates: Record<string, unknown> = { quantity: newQuantity };
      if (category) updates.category = category;
      if (unit) updates.unit = unit;
      if (expiration_date) updates.expiration_date = expiration_date;
      if (threshold !== null) updates.threshold = threshold;
      if (location) updates.location = location;
      if (default_location) updates.default_location = default_location;

      const { data: updated, error } = await db
        .from("inventory")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      item = updated;
    } else {
      // Insert new row
      const row: Record<string, unknown> = {
        name,
        category,
        quantity,
        unit,
      };
      if (expiration_date) row.expiration_date = expiration_date;
      if (threshold !== null) row.threshold = threshold;
      if (location) row.location = location;
      if (default_location) row.default_location = default_location;

      const { data: inserted, error } = await db
        .from("inventory")
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      item = inserted;
    }

    const { actor_role, actor_name } = getActor(request, body);
    await logActivity({
      actor_role,
      actor_name,
      action: existing ? "updated" : "created",
      entity_type: "inventory",
      entity_id: item?.id != null ? String(item.id) : null,
      payload_json: { name, quantity, merged: !!existing },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to create inventory item");
  }
}
