import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/legacy/tasks/[id]
 * Update a legacy task (is_done, title).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await parseBody(request);
    const patch: Record<string, unknown> = {};

    if ("is_done" in body) patch.is_done = body.is_done === true;
    if ("title" in body && body.title) patch.title = String(body.title);

    if (Object.keys(patch).length === 0) {
      return errorResponse(400, "No valid fields to update");
    }

    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * DELETE /api/legacy/tasks/[id]
 * Delete a legacy task.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const db = getDb();
    const { error } = await db
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
