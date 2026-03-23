import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";

/**
 * GET /api/legacy/tasks
 * List all legacy tasks ordered by id desc.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/legacy/tasks
 * Create a new legacy task.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const title = body.title ? String(body.title) : null;
    const assignedTo = body.assigned_to ?? null;
    const dayOfWeek = body.day_of_week ?? null;

    if (!title) {
      return errorResponse(400, "title is required");
    }

    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .insert({ title, assigned_to: assignedTo, day_of_week: dayOfWeek })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
