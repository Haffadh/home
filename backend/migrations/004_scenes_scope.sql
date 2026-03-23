-- Migration 004: Add scope, room, created_by, is_active to scenes
-- Safe to re-run (all IF NOT EXISTS).

ALTER TABLE scenes ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'house';
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS room TEXT DEFAULT NULL;
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Constraint: room-scoped scenes must have a room
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_scenes_room_scope'
  ) THEN
    ALTER TABLE scenes ADD CONSTRAINT chk_scenes_room_scope
      CHECK (scope = 'house' OR (scope = 'room' AND room IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scenes_scope ON scenes(scope);
CREATE INDEX IF NOT EXISTS idx_scenes_room ON scenes(room) WHERE room IS NOT NULL;
