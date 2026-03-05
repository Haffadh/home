import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRY,
} from "../lib/auth.js";

export default async function authRoutes(fastify, { db, requireAuth }) {
  // ---- GET /auth/me ----
  if (requireAuth) {
    fastify.get("/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
      return reply.send({ id: request.user.id, role: request.user.role });
    });
  }

  // ---- POST /auth/register ----
  fastify.post("/auth/register", async (request, reply) => {
    const body = request.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role.trim() : "family";

    if (!name) return reply.code(400).send({ ok: false, error: "name required" });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.code(400).send({ ok: false, error: "valid email required" });
    }
    if (password.length < 6) {
      return reply.code(400).send({ ok: false, error: "password must be at least 6 characters" });
    }

    // Check if email already exists
    const { rows: existing } = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existing.length > 0) {
      return reply.code(409).send({ ok: false, error: "email already registered" });
    }

    const password_hash = await hashPassword(password);

    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, password_hash, role]
    );

    const user = rows[0];
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store refresh token hash
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashRefreshToken(refreshToken), expiresAt]
    );

    return reply.code(201).send({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  });

  // ---- POST /auth/login ----
  fastify.post("/auth/login", async (request, reply) => {
    const body = request.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return reply.code(400).send({ ok: false, error: "email and password required" });
    }

    const { rows } = await db.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (rows.length === 0) {
      return reply.code(401).send({ ok: false, error: "invalid email or password" });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return reply.code(401).send({ ok: false, error: "account has no password set — contact admin" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ ok: false, error: "invalid email or password" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashRefreshToken(refreshToken), expiresAt]
    );

    return reply.send({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  });

  // ---- POST /auth/refresh ----
  fastify.post("/auth/refresh", async (request, reply) => {
    const body = request.body || {};
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";

    if (!refreshToken) {
      return reply.code(400).send({ ok: false, error: "refreshToken required" });
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const { rows } = await db.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.name, u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return reply.code(401).send({ ok: false, error: "invalid refresh token" });
    }

    const row = rows[0];

    if (row.revoked || new Date(row.expires_at) < new Date()) {
      return reply.code(401).send({ ok: false, error: "refresh token expired or revoked" });
    }

    // Revoke old token (rotation)
    await db.query("UPDATE refresh_tokens SET revoked = true WHERE id = $1", [row.id]);

    // Issue new pair
    const user = { id: row.user_id, name: row.name, email: row.email, role: row.role };
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashRefreshToken(newRefreshToken), expiresAt]
    );

    return reply.send({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });

  // ---- POST /auth/logout ----
  fastify.post("/auth/logout", async (request, reply) => {
    const body = request.body || {};
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";

    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await db.query(
        "UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1",
        [tokenHash]
      );
    }

    return reply.send({ ok: true });
  });
}
