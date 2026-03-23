import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, getActor, errorResponse } from "@/lib/server/middleware";
import { setDeviceState } from "@/lib/server/services/deviceService";
import { logActivity } from "@/lib/server/activityLog";

async function handleToggle(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await parseBody(request);

  if (typeof body.on !== "boolean") {
    return errorResponse(400, "Missing required field: on (boolean)");
  }

  try {
    const device = await setDeviceState(id, { switch: body.on });

    const { actor_role, actor_name } = getActor(request, body);
    await logActivity({
      actor_role,
      actor_name,
      action: body.on ? "turned_on" : "turned_off",
      entity_type: "device",
      entity_id: id,
      payload_json: { on: body.on },
    });

    return NextResponse.json({ ok: true, device });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to toggle device");
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleToggle(request, ctx);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleToggle(request, ctx);
}
