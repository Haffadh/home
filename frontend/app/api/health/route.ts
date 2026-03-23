import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint — no auth required.
 */
export async function GET() {
  return NextResponse.json({ ok: true, status: "Smart Home Hub backend running" });
}
