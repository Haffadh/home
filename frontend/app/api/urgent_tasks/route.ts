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
 * GET /api/urgent_tasks
 * List all urgent tasks ordered by acknowledged asc, priority desc, id desc.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .select("*")
      .order("acknowledged", { ascending: true })
      .order("priority", { ascending: false })
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/urgent_tasks
 * Create a new urgent task.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const title = body.title ? String(body.title) : null;

    if (!title) {
      return errorResponse(400, "title is required");
    }

    let assignedTo = body.assigned_to ?? null;
    const assignedToName = body.assigned_to_name
      ? String(body.assigned_to_name)
      : null;

    // If assigned_to not set but assigned_to_name is given, look up the user
    if (!assignedTo && assignedToName) {
      const db = getDb();
      const { data: userRow } = await db
        .from("users")
        .select("id")
        .ilike("name", assignedToName)
        .limit(1)
        .single();

      if (userRow) {
        assignedTo = userRow.id;
      }
    }

    const rawPriority = Number(body.priority) || 1;
    const priority = Math.min(Math.max(rawPriority, 1), 3);
    const alertOnFree = body.alert_on_free === true;
    const submittedBy = body.submitted_by ? String(body.submitted_by) : null;

    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .insert({
        title,
        assigned_to: assignedTo,
        priority,
        alert_on_free: alertOnFree,
        submitted_by: submittedBy,
      })
      .select()
      .single();

    if (error) throw error;

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "urgent_task_create",
      entity_type: "urgent_task",
      entity_id: String(data.id),
      payload_json: { title, assigned_to: assignedTo, priority },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
