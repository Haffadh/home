import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/server/middleware";
import { isConfigured } from "@/lib/server/services/hassClient";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  return NextResponse.json({
    ok: true,
    connected: isConfigured(),
    hassUrl: process.env.HASS_URL || "",
  });
}
