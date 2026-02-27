import crypto from "crypto";

// ---- Configuration ----
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Missing required ENV: JWT_SECRET");
  process.exit(1);
}

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes (seconds)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days (seconds)

// ---- Password hashing (using Node's built-in scrypt — no external deps) ----

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;

export async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
    crypto.scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_COST }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_COST }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey));
    });
  });
}

// ---- JWT (minimal, no external deps) ----

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str) {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function signToken(payload, expiresInSeconds = ACCESS_TOKEN_EXPIRY) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    })
  );
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ---- Token generation helpers ----

export function generateAccessToken(user) {
  return signToken(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    ACCESS_TOKEN_EXPIRY
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY };
