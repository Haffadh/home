import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, getActor, errorResponse } from "@/lib/server/middleware";
import { getDb } from "@/lib/server/db";
import { logActivity } from "@/lib/server/activityLog";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data: meals, error } = await db
      .from("meals")
      .select("*")
      .order("type");

    if (error) throw error;

    return NextResponse.json({ ok: true, meals: meals || [] });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to fetch meals");
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await parseBody(request);

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const dish = typeof body.dish === "string" ? body.dish.trim() : "";

  if (!type || !dish) {
    return errorResponse(400, "type and dish are required");
  }

  const drink = typeof body.drink === "string" ? body.drink : null;
  const portions = typeof body.portions === "number" ? body.portions : null;
  const requested_by = typeof body.requested_by === "string" ? body.requested_by : null;

  try {
    const db = getDb();

    // Delete existing meal for this type (upsert pattern)
    await db.from("meals").delete().eq("type", type);

    // Insert new meal
    const row: Record<string, unknown> = { type, dish };
    if (drink) row.drink = drink;
    if (portions !== null) row.portions = portions;
    if (requested_by) row.requested_by = requested_by;

    const { data: meal, error } = await db
      .from("meals")
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    const { actor_role, actor_name } = getActor(request, body);
    await logActivity({
      actor_role,
      actor_name,
      action: "created",
      entity_type: "meal",
      entity_id: meal?.id != null ? String(meal.id) : type,
      payload_json: { type, dish, drink, portions, requested_by },
    });

    return NextResponse.json({ ok: true, meal }, { status: 201 });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to create meal");
  }
}
