-- Phase 2: family requests ride on the existing urgent_tasks table.
-- Safe to re-run.

ALTER TABLE urgent_tasks ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE urgent_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'done'));

-- Old rows must not surface as stale pending requests: anything already
-- acknowledged counts as handled.
UPDATE urgent_tasks SET status = 'done' WHERE acknowledged = true AND status = 'pending';
