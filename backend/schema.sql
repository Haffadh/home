-- Users of the system
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, family, staff, tablet
  created_at TIMESTAMP DEFAULT now()
);

-- Recurring weekly tasks
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  day_of_week INTEGER, -- 0 = Sunday, 6 = Saturday
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- One-time urgent tasks
CREATE TABLE urgent_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Daily meals
CREATE TABLE meals (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner
  description TEXT NOT NULL
);