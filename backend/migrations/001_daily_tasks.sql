-- Daily Tasks (staff): time-windowed tasks with optional recurrence.
-- Uses daily_tasks + daily_task_instances to avoid clashing with existing "tasks" table
-- (existing tasks = weekly recurring by day_of_week for the Today card).

-- Staff daily task template (recurrence rules + time window)
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  staff_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  window_start TIME NOT NULL,
  window_end TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bahrain',
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly')),
  recurrence_days INT[] DEFAULT NULL, -- 0=Sun..6=Sat; used when recurrence='weekly'
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One instance per (task, date) for "mark done for today"
CREATE TABLE IF NOT EXISTS daily_task_instances (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (task_id, due_date)
);

-- Indexes for staff, date, status, and active tasks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_staff_user_id ON daily_tasks(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_is_active ON daily_tasks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_task_id ON daily_task_instances(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_due_date ON daily_task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_daily_task_instances_status ON daily_task_instances(status);

-- Optional: ensure at least one staff user exists for development
INSERT INTO users (name, role) SELECT 'Staff', 'staff' WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'staff' LIMIT 1);
