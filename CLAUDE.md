# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Fastify, Node.js ES modules)
```bash
cd backend
npm install
npm start              # Runs node server.js on port 3001
```

### Frontend (Next.js 16 + React 19)
```bash
cd frontend
npm install
npm run dev            # Dev server on port 3000 (Turbopack)
npm run build          # Production build
npm run lint           # ESLint
```

### Database (PostgreSQL)
```bash
psql -d smarthub -f backend/migrations/001_daily_tasks.sql
psql -d smarthub -f backend/migrations/002_auth.sql
psql -d smarthub -f backend/migrations/003_activity_log.sql
```

Both frontend and backend must be running for full functionality. The backend dev-token (`Authorization: Bearer dev-token`) maps to `{ id: "dev", role: "admin" }` for local testing.

## Architecture

**Monorepo** with two independent apps — no shared workspace tooling.

### Backend
- **Fastify 5** server (`backend/server.js`) — single file registers all routes inline plus route files from `routes/`.
- **PostgreSQL** via `pg` client — schema in `backend/schema.sql`, migrations in `backend/migrations/`.
- **Custom JWT auth** (`backend/lib/auth.js`) — scrypt password hashing, 15-min access tokens, 7-day refresh tokens with rotation. Middleware in `backend/middleware/auth.js` provides `requireAuth` and `requireRole()`.
- **WebSocket** at `/ws` — broadcasts real-time events (`tasks_updated`, `urgent_updated`, `groceries_updated`, etc.) to all connected clients.
- **Home Assistant integration** (`backend/services/hassClient.js`) — controls smart home devices via HA REST API (`GET /api/states`, `POST /api/services/{domain}/{service}`). Auth via long-lived access token.
- **Services** in `backend/services/` — `deviceService` (HA entity→device mapping), `sceneService`, `sceneScheduler`, `mealAIService`, `deviceHealthScheduler`.

### Frontend
- **Next.js 16 App Router** with Tailwind CSS 4, Framer Motion, dnd-kit for drag-and-drop.
- **Zustand store** (`frontend/stores/houseBrain.ts`) — client-side state with localStorage persistence for tasks, meals, groceries, inventory, scenes.
- **API client** (`frontend/lib/api.ts`) — wraps fetch calls to `NEXT_PUBLIC_API_BASE` (default `http://127.0.0.1:3001`) with JWT auth header.
- **Path alias:** `@/*` maps to project root in tsconfig.

### Real-time Strategy
- Primary: WebSocket connection managed by `RealtimeContext` — dispatches browser custom events on `window`.
- Fallback: 30-second polling when WebSocket disconnects.
- Optional: Supabase Realtime via `GlobalRealtimeContext` (if Supabase env vars are set).

### Auth Flow
- Login page (`/login`) uses role selection; admin panel requires triple-tap and passcode "3866".
- JWT token stored in localStorage as `smarthub_token`.
- `AuthContext` verifies token on load via `GET /auth/me`, provides `user`, `token`, `role`, `login()`, `logout()`.

### Roles & Permissions
Roles: `house`, `kitchen`, `abdullah`, `winklevi_room`, `mariam_room`, `master_bedroom`, `dining_room`, `living_room`, `admin`.

Two permission systems in `frontend/lib/`:
- `permissions.ts` — granular permissions (`viewTasks`, `createTasks`, `controlDevices`, etc.) checked via `canPermission(role, perm)`.
- `roles.ts` — legacy sidebar/dashboard permissions checked via `can(role, perm)`.

`kitchen` and `admin` have full access; room roles are view-only; `house` can delegate tasks and choose meals.

### Key Data Model (PostgreSQL)
- `users`, `refresh_tokens` — auth
- `tasks` (scheduled), `urgent_tasks` (ad-hoc), `daily_tasks` + `daily_task_instances` — task system with time windows (morning/afternoon/evening)
- `groceries` — shopping list
- `activity_log` — audit trail

### Page Structure
- `/panel/{role}` — role-specific dashboards (house, kitchen, abdullah, room panels, admin)
- `/devices`, `/groceries`, `/family`, `/scenes`, `/todays-tasks`, `/notifications` — feature pages
- `DashboardShell` wraps all authenticated pages with navigation, scene triggers, and real-time providers.

## Environment Variables

Backend `.env`: `HASS_URL` (e.g. `http://homeassistant.local:8123`), `HASS_TOKEN` (long-lived access token), `HASS_DEVICE_ROOMS` (optional, `entity_id:room,...`), `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `PORT`, `OPENAI_API_KEY`.

Frontend `.env.local`: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SUPABASE_URL` (optional), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional).
