# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working with this repository.

## Development Commands

Single Next.js 16 app inside `frontend/`. No backend directory — API routes live in `frontend/app/api/*`.

```bash
cd frontend
npm install
npm run dev            # Dev server on port 3000 (Turbopack)
npm run build          # Production build
npm run lint           # ESLint
```

**Dev auth token:** `Authorization: Bearer dev-token` maps to `{ id: "dev", role: "admin" }` for local testing via `authenticateRequest` in `frontend/lib/server/middleware.ts`.

## Architecture

**Single Next.js 16 app** deployed to Vercel. All backend concerns (auth, data, AI) run as Next.js API routes backed by Supabase.

### API layer (`frontend/app/api/*`)
- **Auth:** `/api/auth/{login,logout,me,refresh,register,role-login}` — custom JWT (scrypt password hashing, 15-min access, 7-day refresh with rotation). Middleware in `frontend/lib/server/middleware.ts` provides `authenticateRequest` + `requireRole`.
- **Data routes:** `/api/{tasks,urgent_tasks,groceries,inventory,meals,scenes,devices,activity,notifications,weather,users,music,today}` — all read/write via Supabase.
- **AI:** `/api/ai/howto` (step-by-step task guidance), `/api/meals/suggestions` (context-aware meal AI), `/api/inventory/audit-photo` (vision-based pantry scan). Powered by **Claude Haiku 4.5** via `@anthropic-ai/sdk`. Client code in `frontend/lib/server/services/anthropicClient.ts` and `frontend/lib/server/services/mealAIService.ts`.
- **Home Assistant (optional):** `/api/devices/*`, `/api/integrations/hass/status`. Disabled until `HASS_URL` + `HASS_TOKEN` are set.

### Database: Supabase
- Project: `zloifhakskeyvehlrhqh` (hardcoded in `.env.local`).
- Server-side access via `frontend/lib/server/db.ts` — uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS; falls back to anon key if service role not set.
- Tables: `scheduled_tasks`, `urgent_tasks`, `daily_tasks` + `daily_task_instances`, `meals`, `groceries`, `inventory`, `scenes`, `activity_log`, `notifications`, `users`, `refresh_tokens`.

### Frontend
- **Next.js 16 App Router** with Tailwind CSS 4, Framer Motion 12, dnd-kit for drag-and-drop.
- **Zustand store** (`frontend/stores/houseBrain.ts`) — client-side state with localStorage persistence for tasks, meals, groceries, inventory, scenes.
- **API client** (`frontend/lib/api.ts`) — wraps fetch calls to `NEXT_PUBLIC_API_BASE` (empty = same-origin) with Bearer token from localStorage (`smarthub_token`) or Supabase session.
- **Path alias:** `@/*` maps to `frontend/` root in tsconfig.
- **Motion tokens:** `frontend/lib/motion.ts` — shared variants/transitions for page entry, stagger, card reveal, modals. `frontend/app/template.tsx` applies a subtle entry fade to every routed page.

### Real-time
- Primary: **Supabase Realtime** via `GlobalRealtimeContext` — listens on `postgres_changes` for tasks/meals/groceries/scenes/inventory.
- Fallback: polling via `RealtimeContext` dispatches `window` custom events every 8s.

### Auth & panels
- Login at `/login` — family member list (Moeen, Samya, Nawaf, Ahmed, Mariam, Abdullah) + Kitchen option + triple-tap title → admin passcode `3866`.
- Passwords: `{Name}#1` for each role (e.g., `Moeen#1`, `Kitchen#1`).
- Token in localStorage as `smarthub_token` / `token`. Supabase session also consulted.
- **Panels:** `/panel/house` (family dashboard — simplified), `/panel/kitchen` (full dashboard), `/panel/admin` (full + admin controls). Room panels removed; rooms remain as task-assignment metadata in `frontend/lib/rooms.ts`.

### Roles & permissions
Roles: `moeen`, `samya`, `nawaf`, `ahmed`, `mariam`, `abdullah`, `kitchen`, `admin`.
- `admin` + `kitchen` → `/panel/kitchen` (full MainDashboard).
- Family + `abdullah` → `/panel/house` (FamilyDashboard).
- Permission layers: `frontend/lib/permissions.ts` (granular keys like `viewTasks`, `controlDevices`) and legacy sidebar perms via `can(role, perm)`.

## Environment Variables

**Frontend `.env.local` / Vercel env:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side writes (bypasses RLS). Recommended.
- `JWT_SECRET` — custom JWT signing for role-login.
- `NEXT_PUBLIC_API_BASE` — empty string for same-origin (default).
- `ANTHROPIC_API_KEY` — Claude Haiku 4.5 for AI features. Features no-op if missing.
- `HASS_URL`, `HASS_TOKEN`, `HASS_DEVICE_ROOMS` — Home Assistant (optional, phased in later).

## Deployment

Vercel project `smart-home-hub` (frontend/.vercel/project.json). `npm run build` passes; `npx vercel --prod` from `frontend/` deploys.
