import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { updateScene, deleteScene } from "@/lib/server/services/sceneService";

/**
 * PATCH /api/scenes/[id]
 * Update a scene.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await parseBody(request);
    const scene = await updateScene(id, body);
    return NextResponse.json({ ok: true, scene });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * DELETE /api/scenes/[id]
 * Delete a scene.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    await deleteScene(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
