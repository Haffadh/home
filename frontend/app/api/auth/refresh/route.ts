import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY,
} from "@/lib/server/auth";
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

    // Look up refresh token joined with users
    const { data: record, error: lookupErr } = await db
      .from("refresh_tokens")
      .select("id, user_id, revoked, expires_at, users(id, name, email, role)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (lookupErr) {
      return errorResponse(500, lookupErr.message);
    }
    if (!record) {
      return errorResponse(401, "Invalid refresh token");
    }
    if (record.revoked) {
      return errorResponse(401, "Refresh token has been revoked");
    }
    if (new Date(record.expires_at) < new Date()) {
      return errorResponse(401, "Refresh token has expired");
    }

    // Revoke the old token
    const { error: revokeErr } = await db
      .from("refresh_tokens")
      .update({ revoked: true })
      .eq("id", record.id);

    if (revokeErr) {
      return errorResponse(500, revokeErr.message);
    }

    // Extract user from the joined data
    const user = record.users as unknown as {
      id: string | number;
      name: string;
      email: string;
      role: string;
    };

    // Issue new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashRefreshToken(newRefreshToken);

    const { error: insertErr } = await db.from("refresh_tokens").insert({
      user_id: user.id,
      token_hash: newRefreshHash,
      expires_at: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY * 1000
      ).toISOString(),
    });

    if (insertErr) {
      return errorResponse(500, insertErr.message);
    }

    return NextResponse.json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(500, message);
  }
}
