import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  requireRole,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";

const VALID_TYPES = ["breakfast", "lunch", "dinner"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/meals?date=YYYY-MM-DD
 * Returns up to 3 rows (breakfast/lunch/dinner) for the given date.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse(400, "date must be YYYY-MM-DD");
    }

    const db = getDb();
    const { data, error } = await db
      .from("meals")
      .select("id, date, meal_type, name, created_at")
      .eq("date", date);
    if (error) throw error;

    return NextResponse.json({ ok: true, date, meals: data || [] });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/meals — admin only.
 * Body: { date, meal_type, name }. Upserts on (date, meal_type).
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  const roleErr = requireRole(auth, "admin");
  if (roleErr) return roleErr;

  try {
    const body = await parseBody(request);
    const date = (body.date as string) || todayISO();
    const meal_type = body.meal_type as string | undefined;
    const name = body.name as string | undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse(400, "date must be YYYY-MM-DD");
    }
    if (!meal_type || !VALID_TYPES.includes(meal_type)) {
      return errorResponse(400, `meal_type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse(400, "name is required");
    }

    const db = getDb();
    const { data, error } = await db
      .from("meals")
      .upsert(
        { date, meal_type, name: name.trim() },
        { onConflict: "date,meal_type" }
      )
      .select("id, date, meal_type, name, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
