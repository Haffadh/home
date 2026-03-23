import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";
import { getAIMealSuggestions } from "@/lib/server/services/mealAIService";

/**
 * GET /api/meals/suggestions?slot=breakfast|lunch|dinner
 * Returns AI-powered meal suggestions with full context (inventory, history, day awareness).
 * No body needed — the server gathers all context automatically.
 */
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const slot = request.nextUrl.searchParams.get("slot") as "breakfast" | "lunch" | "dinner" | null;

  try {
    const suggestions = await getAIMealSuggestions(slot ? { slot } : undefined);
    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to get meal suggestions");
  }
}

/** Legacy POST support */
export async function POST(request: NextRequest) {
  return GET(request);
}
