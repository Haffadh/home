import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY,
} from "@/lib/server/auth";
import {
  parseBody,
  errorResponse,
  authenticateRequest,
  isAuthError,
  requireRole,
} from "@/lib/server/middleware";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors Role in lib/roles.ts. An unrecognised role would create a user who
    cannot be routed anywhere by defaultRouteFor(). */
const VALID_ROLES = [
  "moeen",
  "samya",
  "nawaf",
  "ahmed",
  "mariam",
  "abdullah",
  "kitchen",
  "admin",
];

/**
 * POST /api/auth/register — admin only.
 *
 * This was open to the world and honoured whatever `role` the caller put in
 * the body, so anyone who could reach the deployment could mint themselves an
 * admin account. Account creation is an admin action; there is no self-signup
 * in a household app.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRole(auth, "admin");
  if (forbidden) return forbidden;

  try {
    const body = await parseBody(request);
    const name = body.name as string | undefined;
    const email = body.email as string | undefined;
    const password = body.password as string | undefined;
    const role = (body.role as string) || "house";

    if (!VALID_ROLES.includes(role)) {
      return errorResponse(400, `Invalid role: ${role}`);
    }

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
