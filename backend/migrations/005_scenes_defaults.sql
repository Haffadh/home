-- Migration 005: Seed default scenes per room + house-wide.
-- Safe to re-run (ON CONFLICT DO NOTHING).

-- ─── Bedroom scenes (3 per room) ────────────────────────────────────────────

-- Master Bedroom
INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_bedtime_master_bedroom', 'Bedtime', '🌙', 'Lights off, AC to 24°',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24}}]'::jsonb,
   'room', 'Master Bedroom', 'system', true),
  ('default_morning_master_bedroom', 'Morning', '☀️', 'Lights on, AC off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":true}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24,"switch":false}}]'::jsonb,
   'room', 'Master Bedroom', 'system', true),
  ('default_away_master_bedroom', 'Away', '🚪', 'Everything off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}}]'::jsonb,
   'room', 'Master Bedroom', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- Winklevi Room
INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_bedtime_winklevi_room', 'Bedtime', '🌙', 'Lights off, AC to 24°',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24}}]'::jsonb,
   'room', 'Winklevi Room', 'system', true),
  ('default_morning_winklevi_room', 'Morning', '☀️', 'Lights on, AC off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":true}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24,"switch":false}}]'::jsonb,
   'room', 'Winklevi Room', 'system', true),
  ('default_away_winklevi_room', 'Away', '🚪', 'Everything off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}}]'::jsonb,
   'room', 'Winklevi Room', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- Mariam Room
INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_bedtime_mariam_room', 'Bedtime', '🌙', 'Lights off, AC to 24°',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24}}]'::jsonb,
   'room', 'Mariam Room', 'system', true),
  ('default_morning_mariam_room', 'Morning', '☀️', 'Lights on, AC off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":true}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24,"switch":false}}]'::jsonb,
   'room', 'Mariam Room', 'system', true),
  ('default_away_mariam_room', 'Away', '🚪', 'Everything off',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}}]'::jsonb,
   'room', 'Mariam Room', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Common area scenes (2 per area) ────────────────────────────────────────

-- Kitchen
INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_movie_night_kitchen', 'Movie Night', '🎬', 'Dim lights',
   '[{"type":"device_command","deviceId":"ALL","command":{"brightness":25}}]'::jsonb,
   'room', 'Kitchen', 'system', true),
  ('default_guests_coming_kitchen', 'Guests Coming', '🏠', 'All lights on, AC on',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":true}},{"type":"device_command","deviceId":"ALL","command":{"temperature":23}}]'::jsonb,
   'room', 'Kitchen', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- Living Room
INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_movie_night_living_room', 'Movie Night', '🎬', 'Dim lights',
   '[{"type":"device_command","deviceId":"ALL","command":{"brightness":25}}]'::jsonb,
   'room', 'Living Room', 'system', true),
  ('default_guests_coming_living_room', 'Guests Coming', '🏠', 'All lights on, AC on',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":true}},{"type":"device_command","deviceId":"ALL","command":{"temperature":23}}]'::jsonb,
   'room', 'Living Room', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- ─── House-wide scenes ──────────────────────────────────────────────────────

INSERT INTO scenes (id, name, icon, description, actions, scope, room, created_by, is_active)
VALUES
  ('default_going_out', 'Going Out', '🚪', 'All off, secure the house',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}}]'::jsonb,
   'house', NULL, 'system', true),
  ('default_goodnight', 'Goodnight', '🌙', 'All rooms bedtime — lights off, AC 24°',
   '[{"type":"device_command","deviceId":"ALL","command":{"switch":false}},{"type":"device_command","deviceId":"ALL","command":{"temperature":24}}]'::jsonb,
   'house', NULL, 'system', true)
ON CONFLICT (id) DO NOTHING;
