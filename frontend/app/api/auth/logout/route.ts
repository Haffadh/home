import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { hashRefreshToken } from "@/lib/server/auth";
import { parseBody, errorResponse } from "@/lib/server/middleware";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const refreshToken = body.refreshToken as string | undefined;

    if (!refreshToken) {
      return errorResponse(400, "refreshToken is required");
    }

    const db = getDb();
    const tokenHash = hashRefreshToken(refreshToken);

    // Mark as revoked
    const { error } = await db
      .from("refresh_tokens")
      .update({ revoked: true })
      .eq("token_hash", tokenHash);

    if (error) {
      return errorResponse(500, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(500, message);
  }
}
