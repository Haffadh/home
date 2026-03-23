import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, parseBody, errorResponse } from "@/lib/server/middleware";
import { analyzeInventoryPhoto } from "@/lib/server/services/openaiClient";

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await parseBody(request);
  const image = typeof body.image === "string" ? body.image : "";
  const expectedItems = Array.isArray(body.expectedItems) ? body.expectedItems.map(String) : [];

  if (!image) {
    return errorResponse(400, "image is required (base64 string)");
  }

  try {
    const result = await analyzeInventoryPhoto(image, expectedItems);

    if (!result.ok) {
      return errorResponse(500, (result as { detail?: string }).detail || "Photo analysis failed");
    }

    return NextResponse.json({
      ok: true,
      found: (result as { found: unknown[] }).found,
      unexpected: (result as { unexpected: unknown[] }).unexpected,
    });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to analyze photo");
  }
}
