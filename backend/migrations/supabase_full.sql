-- =============================================================================
-- Smart Home Hub — Full Supabase Migration
-- Creates all 13 tables with indexes, constraints, and RLS disabled.
-- Safe to re-run (all CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- =============================================================================

-- ─── 1. users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  password_hash TEXT DEFAULT NULL,
  role TEXT DEFAULT 'family',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- ─── 2. refresh_tokens ──────────────────────────────────────────────────────
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

-- ─── 3. tasks (legacy weekly recurring) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER,
  day_of_week INTEGER,
  is_done BOOLEAN DEFAULT false,
  date DATE,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'pending',
  category TEXT,
  gathering_id TEXT,
  is_auto_generated BOOLEAN DEFAULT false,
  assigned_by TEXT,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. scheduled_tasks (new date-based tasks) ─────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT,
  date DATE,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  category TEXT,
  gathering_id TEXT,
  is_auto_generated BOOLEAN DEFAULT false,
  assigned_by TEXT,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. urgent_tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS urgent_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER,
  priority INTEGER DEFAULT 1,
  alert_on_free BOOLEAN DEFAULT false,
  submitted_by TEXT,
  seen BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. meals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  dish TEXT,
  drink TEXT,
  portions INTEGER DEFAULT 1,
  requested_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. inventory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Food',
  quantity NUMERIC DEFAULT 1,
  expiration_date DATE,
  unit TEXT DEFAULT 'pcs',
  threshold INTEGER DEFAULT 2,
  location TEXT,
  default_location TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 8. groceries ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groceries (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  requested_by TEXT,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. scenes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '✨',
  description TEXT DEFAULT '',
  actions JSONB DEFAULT '[]'::jsonb,
  schedule JSONB DEFAULT NULL,
  scope TEXT NOT NULL DEFAULT 'house',
  room TEXT DEFAULT NULL,
  created_by TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT chk_scenes_room_scope CHECK (scope = 'house' OR (scope = 'room' AND room IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_scenes_scope ON scenes(scope);
CREATE INDEX IF NOT EXISTS idx_scenes_room ON scenes(room) WHERE room IS NOT NULL;

-- ─── 10. daily_tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  staff_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  window_start TIME NOT NULL DEFAULT '08:00',
  window_end TIME NOT NULL DEFAULT '12:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Bahrain',
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  recurrence_days INT[] DEFAULT NULL,
  recurrence_day_of_month INTEGER DEFAULT NULL,
  recurrence_interval INTEGER DEFAULT NULL,
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

-- ─── 11. daily_task_instances ───────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_status ON daily_task_instances(status);

-- ─── 12. activity_log ───────────────────────────────────────────────────────
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

-- ─── 13. notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ─── Realtime: enable for tables the frontend subscribes to ─────────────────
-- Supabase Realtime listens to tables added to the supabase_realtime publication.
DO $$
BEGIN
  -- notifications (used by NotificationPanel + GlobalRealtimeContext)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ─── Disable RLS on all tables (app uses service-role key / JWT middleware) ──
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE groceries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- Allow full access for service_role (backend / server-side API routes)
-- and read/write for anon (frontend with anon key — tighten later if needed)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'refresh_tokens', 'tasks', 'scheduled_tasks',
      'urgent_tasks', 'meals', 'inventory', 'groceries',
      'scenes', 'daily_tasks', 'daily_task_instances',
      'activity_log', 'notifications'
    ])
  LOOP
    -- service_role: full access (already implicit, but explicit for clarity)
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "service_role_all_%1$s" ON %1$I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl
    );
    -- anon: full access for MVP (tighten per-role later)
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "anon_all_%1$s" ON %1$I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl
    );
    -- authenticated: full access
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "authenticated_all_%1$s" ON %1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ─── Seed: ensure at least one staff user for development ───────────────────
INSERT INTO users (name, role)
SELECT 'Staff', 'staff'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'staff' LIMIT 1);

-- =============================================================================
-- Done. All 13 tables created with indexes, RLS policies, and realtime enabled.
-- =============================================================================
