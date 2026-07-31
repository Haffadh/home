import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

/**
 * GET /api/requests/mine
 * The caller's own requests, newest first. Scoped to the token's user id —
 * there is no way to read another user's requests through this route.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data, error } = await db
      .from("urgent_tasks")
      .select("id, title, note, status, created_at")
      .eq("submitted_by", String(auth.id))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
