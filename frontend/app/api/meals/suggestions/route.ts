import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, errorResponse } from "@/lib/server/middleware";
import { getAIMealSuggestions } from "@/lib/server/services/mealAIService";

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await parseBody(request);

  const inventory = Array.isArray(body.inventory) ? body.inventory.map(String) : [];
  const expiringSoon = Array.isArray(body.expiringSoon) ? body.expiringSoon.map(String) : [];
  const householdSize = typeof body.householdSize === "number" ? body.householdSize : undefined;

  try {
    const suggestions = await getAIMealSuggestions({
      inventory,
      expiringSoon,
      householdSize,
    });

    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to get meal suggestions");
  }
}
