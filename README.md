# Smart Home Hub

## Backend

### Setup

1. Install Node.js (v18+).
2. Clone the repo and from the project root run:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root with the required variables (see below).
4. Ensure PostgreSQL is running and a database `smarthub` exists (see `schema.sql` if needed).

### Required ENV

Set these in `.env` at the project root. The server exits at startup if any are missing.

| Variable | Description |
|----------|-------------|
| `TUYA_ACCESS_ID` | Tuya Cloud API access ID |
| `TUYA_ACCESS_SECRET` | Tuya Cloud API access secret |
| `TUYA_ENDPOINT` | Tuya API base URL (e.g. `https://openapi.tuyaeu.com`) |
| `TUYA_DEVICE_IDS` | Comma-separated list of device IDs to expose via `/devices` |

Optional:

- `PORT` – Server port (default: `3001`)
- `OPENAI_API_KEY` – For `/ai/howto` and related features

### Run commands

```bash
# Install dependencies
npm install

# Start the backend server
npm start
# or
node server.js
```

Server listens on `http://localhost:3001` by default (or the value of `PORT`).

### Example API calls

```bash
# Health check
curl -s http://localhost:3001/health

# List devices (filtered by TUYA_DEVICE_IDS)
curl -s http://localhost:3001/devices

# Toggle device on/off (body: { "on": true } or { "on": false })
curl -s -X POST http://localhost:3001/devices/YOUR_DEVICE_ID/toggle \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Same via /switch
curl -s -X POST http://localhost:3001/devices/YOUR_DEVICE_ID/switch \
  -H "Content-Type: application/json" \
  -d '{"on": false}'
```

All error responses use the format `{ "ok": false, "error": "<message>" }`. Success responses use `{ "ok": true, ... }` (and optionally `data` or other keys).

---

## Daily Tasks (staff)

Time-windowed tasks for household staff with optional recurrence (none / daily / weekly). Tasks are stored in Postgres; instances are materialized on-demand for a given date. Staff can mark tasks **Done** or **Skip** for that day (no smart-home triggering).

### Run instructions

1. **Run migrations** (from project root, with Postgres running and `smarthub` DB created):
   ```bash
   psql -d smarthub -f migrations/001_daily_tasks.sql
   ```
   This creates `daily_tasks` and `daily_task_instances` and ensures at least one `staff` user exists if none present.

2. **Start backend**: `npm start` (or `node server.js`).

3. **Start frontend** (from `frontend/`): `npm run dev`. Open http://localhost:3000/todays-tasks.

### Example API calls (Daily Tasks)

```bash
# List tasks for a staff user and date (instances materialized on demand)
curl -s "http://localhost:3001/daily-tasks?staff_user_id=1&date=2025-02-12"

# Create a task (time window, recurrence, start/end date)
curl -s -X POST http://localhost:3001/daily-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "staff_user_id": 1,
    "title": "Morning cleanup",
    "notes": "Kitchen and living room",
    "window_start": "07:00",
    "window_end": "08:00",
    "timezone": "Asia/Bahrain",
    "recurrence": "daily",
    "start_date": "2025-02-12"
  }'

# Mark today’s instance as done (idempotent)
curl -s -X POST http://localhost:3001/daily-tasks/1/complete \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-02-12"}'

# Mark today’s instance as skipped
curl -s -X POST http://localhost:3001/daily-tasks/1/skip \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-02-12"}'

# Update a task
curl -s -X PATCH http://localhost:3001/daily-tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated title", "window_end": "09:00"}'
```

---

## Repo hygiene

- **`.env`** is ignored; copy **`.env.example`** to `.env` and fill in values. Do not commit `.env`.
- If **`node_modules`** or **`.npm-cache`** were ever committed, remove from git index (no delete on disk):
  ```bash
  git rm -r --cached node_modules 2>/dev/null || true
  git rm -r --cached .npm-cache 2>/dev/null || true
  ```
- If you see **`fatal: Unable to create '.git/index.lock'`**: another git process may be running, or a previous run crashed. Remove the lock only when you are sure no other git command is running: `rm -f .git/index.lock`. See [Git docs](https://git-scm.com/docs/git-index) if unsure.

---

## Checklist (run migrations, server, verify)

| Step | Command / action |
|------|------------------|
| 1. Run migrations | `psql -d smarthub -f migrations/001_daily_tasks.sql` |
| 2. Start backend | `npm start` (root) |
| 3. Verify health | `curl -s http://localhost:3001/health` → `{"ok":true}` |
| 4. Verify daily-tasks | `curl -s "http://localhost:3001/daily-tasks?staff_user_id=1&date=$(date +%Y-%m-%d)"` → `{"ok":true,"tasks":[...],"date":"..."}` |
| 5. Start frontend | `cd frontend && npm run dev` |
| 6. Open UI | http://localhost:3000 and http://localhost:3000/todays-tasks |
