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
import { runScene } from "@/lib/server/services/sceneService";

/**
 * POST /api/scenes/[id]/trigger
 * Trigger a scene's actions (alias for run using id param).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const body = await parseBody(request);

    const result = await runScene(id, {
      createUrgentTask: async (opts: { title: string; assigned_to?: number | null }) => {
        const db = getDb();
        const { data } = await db
          .from("urgent_tasks")
          .insert({ title: opts.title, assigned_to: opts.assigned_to })
          .select()
          .single();
        return data;
      },
      logActivity: async (opts: Record<string, unknown>) => {
        await logActivity(opts as Parameters<typeof logActivity>[0]);
      },
      getActor: () => getActor(request, body),
    });

    return NextResponse.json({
      ...result,
      id,
    });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
