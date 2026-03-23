import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";
import { getDevices } from "@/lib/server/services/deviceService";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const devices = await getDevices();
    const room = request.nextUrl.searchParams.get("room");

    if (room) {
      const filtered = devices.filter(
        (d) => d.room && d.room.toLowerCase() === room.toLowerCase()
      );
      return NextResponse.json({ ok: true, devices: filtered });
    }

    return NextResponse.json({ ok: true, devices });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to fetch devices");
  }
}
