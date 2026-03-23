import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";

/**
 * GET /api/users
 * List all users.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data, error } = await db
      .from("users")
      .select("id, name, role, created_at")
      .order("id", { ascending: true });

    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) {
      return NextResponse.json([
        { id: "dev", name: "Admin", role: "admin", created_at: new Date().toISOString() },
      ]);
    }

    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/users
 * Create a new user.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const name = body.name ? String(body.name) : null;
    const role = body.role ? String(body.role) : null;

    if (!name || !role) {
      return errorResponse(400, "name and role are required");
    }

    const db = getDb();
    const { data, error } = await db
      .from("users")
      .insert({ name, role })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
