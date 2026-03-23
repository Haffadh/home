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
 * GET /api/groceries
 * List all grocery items ordered by id desc.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data, error } = await db
      .from("groceries")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/groceries
 * Add a new grocery item.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const title = body.name ? String(body.name) : body.title ? String(body.title) : null;
    const requestedBy = body.requestedBy ? String(body.requestedBy) : null;

    if (!title) {
      return errorResponse(400, "name or title is required");
    }

    const db = getDb();
    const { data, error } = await db
      .from("groceries")
      .insert({ title, requested_by: requestedBy })
      .select()
      .single();

    if (error) throw error;

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "grocery_create",
      entity_type: "grocery",
      entity_id: String(data.id),
      payload_json: { title },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
