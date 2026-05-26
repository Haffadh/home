import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  errorResponse,
} from "@/lib/server/middleware";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/meals/[id] — admin only.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleErr = requireRole(auth, "admin");
  if (roleErr) return roleErr;

  try {
    const { id } = await params;
    const mealId = parseInt(id, 10);
    if (isNaN(mealId)) return errorResponse(400, "Invalid meal id");

    const db = getDb();
    const { error } = await db.from("meals").delete().eq("id", mealId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
