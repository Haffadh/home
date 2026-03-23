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
 * PATCH /api/tasks/reorder
 * Update start_time and end_time for multiple tasks (drag-and-drop reorder).
 */
export async function PATCH(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const tasks = body.tasks;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return errorResponse(400, "tasks array is required");
    }

    const db = getDb();

    for (const t of tasks) {
      const task = t as Record<string, unknown>;
      if (!task.id) continue;

      const patch: Record<string, unknown> = {};
      if (task.startTime !== undefined) patch.start_time = task.startTime;
      if (task.endTime !== undefined) patch.end_time = task.endTime;

      if (Object.keys(patch).length > 0) {
        const { error } = await db
          .from("scheduled_tasks")
          .update(patch)
          .eq("id", String(task.id));

        if (error) throw error;
      }
    }

    const actor = getActor(request, body);
    await logActivity({
      ...actor,
      action: "tasks_reorder",
      entity_type: "scheduled_task",
      payload_json: { count: tasks.length },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
