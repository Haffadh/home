-- JWT Auth: add password_hash to users, create refresh_tokens table.

-- Add password_hash column (nullable so existing users aren't broken)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- Add email column for login (unique, nullable for existing rows)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Refresh tokens for token rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Clean up expired/revoked tokens periodically (optional, can be done in app)
