# Abdullah Task Manager

Minimal household task management. Abdullah signs in, sees his daily tasks, marks them done or skipped. Admin creates, edits, and deletes tasks.

## Stack

- Next.js 16 (App Router) — single app, no separate backend.
- Supabase (Postgres) — auth users, daily_tasks, daily_task_instances, urgent_tasks, refresh_tokens, activity_log.
- Custom JWT (scrypt password hashing, 30-day access tokens).

## Setup

1. Create a Supabase project at https://supabase.com/dashboard.
2. Apply schema: open SQL Editor and run [`docs/schema.sql`](docs/schema.sql).
3. Create `frontend/.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # required to bypass RLS
   JWT_SECRET=<random 32+ char string>
   NEXT_PUBLIC_API_BASE=
   ```
4. Install + run:
   ```bash
   cd frontend
   npm install
   npm run dev          # http://localhost:3000
   npm run build        # production build
   ```

## Endpoints

All routes accept `Authorization: Bearer <accessToken>`. The dev token `dev-token` is accepted as `{ id: "dev", role: "admin" }`.

### Auth

- `POST /auth/register` — `{ name, email, password, role }` → `{ ok, user, accessToken, refreshToken }`
- `POST /auth/login` — `{ email, password }` → `{ ok, user, accessToken, refreshToken }`
- `POST /auth/logout` — revoke refresh token
- `POST /auth/refresh` — rotate refresh token
- `GET  /auth/me` — `{ id, role }` from the bearer token

### Daily tasks

- `GET  /daily-tasks?staff_user_id=<id>&date=YYYY-MM-DD` — list a staff user's tasks for the date, with the per-day instance (`pending`/`done`/`skipped`) materialized.
- `POST /daily-tasks` — create. Body: `{ staff_user_id, title, notes?, window_start, window_end, recurrence: "none"|"daily"|"weekly"|"monthly"|"custom", recurrence_days?, start_date?, end_date?, room?, category? }`.
- `PATCH /daily-tasks/:id` — update any of `title, notes, window_start, window_end, timezone, recurrence, recurrence_days, start_date, end_date, is_active`. Use `is_active: false` for soft delete.
- `POST /daily-tasks/:id/complete` — `{ date: YYYY-MM-DD }` (defaults to today).
- `POST /daily-tasks/:id/skip` — same.

### Meals (today's menu)

- `GET  /meals?date=YYYY-MM-DD` — returns up to 3 rows (`breakfast`, `lunch`, `dinner`) for the date. Defaults to today.
- `POST /meals` — **admin only**. Body: `{ date?, meal_type: "breakfast"|"lunch"|"dinner", name }`. Upserts on `(date, meal_type)` so calling it again for the same slot replaces the name.
- `DELETE /meals/:id` — **admin only**.

### Urgent tasks

- `GET  /urgent_tasks` — list (sorted: unack first, then priority desc).
- `POST /urgent_tasks` — create.
- `PATCH /urgent_tasks/:id` — update.
- `POST /urgent_tasks/:id/ack` — acknowledge.

### Users

- `GET /api/users` — list all users (admin convenience).
- `GET /api/health` — health check.

## Frontend pages

- `/login` — email + password sign in.
- `/panel/abdullah` — read-only menu at the top + task list with Done/Skip buttons.
- `/panel/admin` — Today's Menu (3 inputs, save on blur) + staff selector + create/list/soft-delete daily tasks.

## End-to-end curl flow

```bash
# 1. Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Abdullah","email":"abdullah@example.com","password":"Abdullah#1","role":"abdullah"}'

# 2. Login → grab accessToken
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abdullah@example.com","password":"Abdullah#1"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# 3. Create a daily task for user id 1
curl -X POST http://localhost:3000/daily-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"staff_user_id":1,"title":"Take out the trash","window_start":"08:00","window_end":"10:00","recurrence":"daily"}'

# 4. List today's tasks
curl "http://localhost:3000/daily-tasks?staff_user_id=1&date=$(date -u +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN"

# 5. Complete task id 1
curl -X POST "http://localhost:3000/daily-tasks/1/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$(date -u +%Y-%m-%d)\"}"
```

## Notes

- URL rewrites in `frontend/next.config.mjs` map clean paths (`/auth/*`, `/daily-tasks/*`, `/urgent_tasks/*`, `/users`) to the underlying `/api/*` Next.js handlers.
- Soft delete only — use `PATCH /daily-tasks/:id` with `{ "is_active": false }`. The instance history is preserved.
- All write operations require a valid Bearer token. Service role key on the server bypasses Supabase RLS.
