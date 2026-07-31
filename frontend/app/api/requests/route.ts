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
 * POST /api/requests
 * A family member asks Abdullah for something. Rides on urgent_tasks:
 * submitted_by = requester's user id (text column), assigned_to = Abdullah.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const title = body.title ? String(body.title).trim() : "";
    const note = body.note ? String(body.note).trim() : "";

    if (!title) {
      return errorResponse(400, "title is required");
    }

    const db = getDb();

    // Same resolution the admin panel uses: the user whose role is "abdullah".
    const { data: abdullah } = await db
      .from("users")
      .select("id")
      .eq("role", "abdullah")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data, error } = await db
      .from("urgent_tasks")
      .insert({
        title,
        note,
        status: "pending",
        submitted_by: String(auth.id),
        assigned_to: abdullah?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "request_create",
      entity_type: "urgent_task",
      entity_id: String(data.id),
      payload_json: { title, submitted_by: String(auth.id) },
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
