import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY,
} from "@/lib/server/auth";
import { parseBody, errorResponse } from "@/lib/server/middleware";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const name = body.name as string | undefined;
    const email = body.email as string | undefined;
    const password = body.password as string | undefined;
    const role = (body.role as string) || "house";

    // Validation
    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse(400, "name is required");
    }
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return errorResponse(400, "Valid email is required");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return errorResponse(400, "Password must be at least 6 characters");
    }

    const db = getDb();

    // Check email uniqueness
    const { data: existing, error: lookupErr } = await db
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (lookupErr) {
      return errorResponse(500, lookupErr.message);
    }
    if (existing) {
      return errorResponse(409, "Email already registered");
    }

    // Hash password & insert user
    const passwordHash = await hashPassword(password);

    const { data: newUser, error: insertErr } = await db
      .from("users")
      .insert({
        name: name.trim(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
      })
      .select("id, name, email, role")
      .single();

    if (insertErr) {
      return errorResponse(500, insertErr.message);
    }

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken();
    const refreshHash = hashRefreshToken(refreshToken);

    // Store refresh token
    const { error: rtErr } = await db.from("refresh_tokens").insert({
      user_id: newUser.id,
      token_hash: refreshHash,
      expires_at: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY * 1000
      ).toISOString(),
    });

    if (rtErr) {
      return errorResponse(500, rtErr.message);
    }

    return NextResponse.json({
      ok: true,
      user: newUser,
      accessToken,
      refreshToken,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(500, message);
  }
}
