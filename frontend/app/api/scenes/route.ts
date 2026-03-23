import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { getScenes, createScene } from "@/lib/server/services/sceneService";
import type { SceneFilters } from "@/lib/server/services/sceneService";

/**
 * GET /api/scenes
 * List scenes. Supports ?scope=room|house and ?room=Kitchen filters.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") as "room" | "house" | null;
    const room = url.searchParams.get("room");

    const filters: SceneFilters = { is_active: true };
    if (scope) filters.scope = scope;
    if (room) filters.room = room;

    const scenes = await getScenes(filters);
    return NextResponse.json({ ok: true, scenes });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * POST /api/scenes
 * Create a new scene.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    // Set created_by from the authenticated user's role if not provided
    if (!body.created_by && !isAuthError(auth)) {
      body.created_by = (auth as { id: string; role: string }).role;
    }
    const scene = await createScene(body);
    return NextResponse.json({ ok: true, scene }, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
