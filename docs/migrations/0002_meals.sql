-- Daily menu: one row per (date, meal_type).
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, meal_type)
);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
