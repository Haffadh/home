CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  name TEXT,
  device_id TEXT,
  room TEXT,
  status INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  device_id INTEGER,
  day_of_week INTEGER,
  hour INTEGER,
  minute INTEGER,
  is_recurring INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  message TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);