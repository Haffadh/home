/**
 * Auth middleware for Next.js API routes.
 * Ported from backend/middleware/auth.js.
 */

import { verifyToken } from "./auth";
import { NextResponse } from "next/server";

export type AuthUser = { id: string; role: string };

/**
 * Authenticate a request. Returns the user payload or a 401 NextResponse.
 */
export function authenticateRequest(request: Request): AuthUser | NextResponse {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: "Authorization header required (Bearer <token>)" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();

  // Development fallback
  if (token === "dev-token") {
    return { id: "dev", role: "admin" };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = verifyToken(token);
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  return { id: String(payload.id), role: String(payload.role) };
}

/**
 * Check if auth result is an error response.
 */
export function isAuthError(result: AuthUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Require specific roles. Returns 403 NextResponse if user's role is not allowed.
 */
export function requireRole(user: AuthUser, ...allowedRoles: string[]): NextResponse | null {
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Extract actor info from request headers/body for activity log.
 */
export function getActor(request: Request, body?: Record<string, unknown>): { actor_role: string | null; actor_name: string | null } {
  const role = (body?.actorRole as string) ?? request.headers.get("x-actor-role") ?? null;
  const name = (body?.actorName as string) ?? request.headers.get("x-actor-name") ?? null;
  return {
    actor_role: typeof role === "string" ? role.slice(0, 64) : null,
    actor_name: typeof name === "string" ? name.slice(0, 128) : null,
  };
}

/** Shorthand: parse JSON body safely */
export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Helper to send error JSON responses */
export function errorResponse(code: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error: String(error).slice(0, 200) }, { status: code });
}
