-- Smart Home Hub: minimal schema for Abdullah task management.
-- Run this in the Supabase SQL editor on a fresh project.
-- Safe to re-run.

-- ===== users =====
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  password_hash TEXT DEFAULT NULL,
  role TEXT DEFAULT 'family',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- ===== refresh_tokens =====
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

-- ===== daily_tasks (Abdullah's recurring tasks) =====
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  staff_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  window_start TIME NOT NULL,
  window_end TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bahrain',
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_days INT[] DEFAULT NULL,
  recurrence_day_of_month INT DEFAULT NULL,
  recurrence_interval INT DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  room TEXT DEFAULT NULL,
  assigned_by TEXT DEFAULT NULL,
  category TEXT DEFAULT 'misc',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_staff_user_id ON daily_tasks(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_is_active ON daily_tasks(is_active) WHERE is_active = true;

-- ===== daily_task_instances (one row per (task, date)) =====
CREATE TABLE IF NOT EXISTS daily_task_instances (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (task_id, due_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_task_id ON daily_task_instances(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_due_date ON daily_task_instances(due_date);

-- ===== urgent_tasks (one-off urgent tasks) =====
CREATE TABLE IF NOT EXISTS urgent_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  priority INTEGER DEFAULT 1,
  alert_on_free BOOLEAN DEFAULT false,
  submitted_by TEXT,
  seen BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_urgent_tasks_acknowledged ON urgent_tasks(acknowledged);

-- ===== activity_log (audit trail, used by API routes) =====
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  actor_role TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_activity_log_ts ON activity_log(ts DESC);

-- ===== meals (daily menu) =====
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, meal_type)
);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
