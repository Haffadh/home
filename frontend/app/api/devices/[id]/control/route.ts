import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, errorResponse } from "@/lib/server/middleware";
import { setDeviceState } from "@/lib/server/services/deviceService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await parseBody(request);

  const command: Record<string, unknown> = {};

  if (typeof body.switch === "boolean") command.switch = body.switch;
  if (typeof body.brightness === "number") command.brightness = body.brightness;
  if (typeof body.temperature === "number") command.temperature = body.temperature;
  if (body.fanSpeed !== undefined) command.fanSpeed = body.fanSpeed;
  if (body.blindsOpen !== undefined) command.blindsOpen = body.blindsOpen;

  try {
    const device = await setDeviceState(id, command);
    return NextResponse.json({ ok: true, device });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to control device");
  }
}
