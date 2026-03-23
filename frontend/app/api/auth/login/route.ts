import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY,
} from "@/lib/server/auth";
import { parseBody, errorResponse } from "@/lib/server/middleware";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const email = body.email as string | undefined;
    const password = body.password as string | undefined;

    if (!email || !password) {
      return errorResponse(400, "email and password are required");
    }

    const db = getDb();

    // Lookup user by email
    const { data: user, error: lookupErr } = await db
      .from("users")
      .select("id, name, email, role, password_hash")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (lookupErr) {
      return errorResponse(500, lookupErr.message);
    }
    if (!user) {
      return errorResponse(401, "Invalid email or password");
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse(401, "Invalid email or password");
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const refreshHash = hashRefreshToken(refreshToken);

    // Store refresh token
    const { error: rtErr } = await db.from("refresh_tokens").insert({
      user_id: user.id,
      token_hash: refreshHash,
      expires_at: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY * 1000
      ).toISOString(),
    });

    if (rtErr) {
      return errorResponse(500, rtErr.message);
    }

    // Return user without password_hash
    const { password_hash: _, ...safeUser } = user;

    return NextResponse.json({
      ok: true,
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(500, message);
  }
}
