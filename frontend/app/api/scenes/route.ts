import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { getScenes, createScene } from "@/lib/server/services/sceneService";

/**
 * GET /api/scenes
 * List all scenes.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const scenes = await getScenes();
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
    const scene = await createScene(body);
    return NextResponse.json({ ok: true, scene }, { status: 201 });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
