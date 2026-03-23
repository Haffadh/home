import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";
import { getDevices } from "@/lib/server/services/deviceService";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const devices = await getDevices(true);
    return NextResponse.json({ ok: true, devices });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to fetch raw devices");
  }
}
