import { verifyToken } from "../lib/auth.js";

/**
 * Extract token from Authorization: Bearer <token>
 * verify with JWT_SECRET and attach decoded user to request.user
 */
async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({
      ok: false,
      error: "Authorization header required (Bearer <token>)"
    });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    // allow dev token
    if (token === "dev-token") {
      request.user = { id: "dev", role: "admin" };
      return;
    }

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