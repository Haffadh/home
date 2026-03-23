import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/services/hassClient";

/**
 * GET /api/env-status
 * Report which integrations are configured — no auth required.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasHass: isConfigured(),
    hassUrl: process.env.HASS_URL || "",
  });
}
