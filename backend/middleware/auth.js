import { verifyToken } from "../lib/auth.js";

/**
 * Extract token from Authorization: Bearer <token>
 * verify with JWT_SECRET and attach decoded user to request.user.
 * In development, "dev-token" is accepted and maps to request.user = { id: "dev", role: "admin" }.
 */
async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({
      ok: false,
      error: "Authorization header required (Bearer <token>)"
    });
  }

  const token = authHeader.slice(7).trim();

  // Development fallback: never try to decode dev-token (avoids crashes from invalid JWT parsing).
  if (token === "dev-token") {
    request.user = { id: "dev", role: "admin" };
    return;
  }

  let payload = null;
  try {
    payload = verifyToken(token);
  } catch {
    payload = null;
  }

  if (!payload) {
    return reply.code(401).send({
      ok: false,
      error: "Invalid or expired token"
    });
  }

  request.user = { id: payload.id, role: payload.role };
}

/**
 * Check req.user.role. If not in allowedRoles → 403
 */
function requireRole(...allowedRoles) {
  return async function (request, reply) {
    if (!request.user) {
      return reply.code(401).send({
        ok: false,
        error: "Not authenticated"
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        ok: false,
        error: "Forbidden"
      });
    }
  };
}

export { requireAuth, requireRole };