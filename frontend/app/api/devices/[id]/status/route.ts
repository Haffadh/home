import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";
import { getDeviceStatus } from "@/lib/server/services/deviceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  try {
    const device = await getDeviceStatus(id);
    return NextResponse.json({ ok: true, device });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to get device status");
  }
}
