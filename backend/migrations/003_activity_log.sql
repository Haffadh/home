-- Activity log: who did what (actor from UI metadata)
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMP DEFAULT now(),
  actor_role TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_activity_log_ts ON activity_log(ts DESC);
