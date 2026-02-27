import { verifyToken } from "./auth.js";

/**
 * Fastify preHandler hook for JWT authentication.
 * Attaches `request.user` with { sub, email, role, name } on success.
 *
 * Usage in server.js:
 *   import { authenticate, requireRole } from "./lib/authMiddleware.js";
 *
 *   // Protect a single route:
 *   fastify.get("/secret", { preHandler: [authenticate] }, handler);
 *
 *   // Protect a single route + require admin role:
 *   fastify.get("/admin", { preHandler: [authenticate, requireRole("admin")] }, handler);
 */

export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ ok: false, error: "Authorization header required (Bearer <token>)" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return reply.code(401).send({ ok: false, error: "Invalid or expired token" });
  }

  // Attach user info to request
  request.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    name: payload.name,
  };
}

/**
 * Returns a preHandler that checks request.user.role.
 * Must be used AFTER authenticate.
 *
 *   { preHandler: [authenticate, requireRole("admin")] }
 *   { preHandler: [authenticate, requireRole("admin", "staff")] }
 */
export function requireRole(...roles) {
  return async function (request, reply) {
    if (!request.user) {
      return reply.code(401).send({ ok: false, error: "Not authenticated" });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ ok: false, error: "Insufficient permissions" });
    }
  };
}
