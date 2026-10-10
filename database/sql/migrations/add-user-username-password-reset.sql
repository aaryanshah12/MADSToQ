-- Login username (IO portal) + password reset tokens.
-- Backfill: existing login ids copy email → username for legacy rows.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username) WHERE username IS NOT NULL;

UPDATE users SET username = email WHERE username IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
