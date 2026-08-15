# Haffadh Home — handoff

State of the app after the Hearth transformation (Phases 0–4) and the Phase 4
verification audit. Written 2026-08-15.

> The root `CLAUDE.md` is **stale** — it describes the pre-2319b22 app (room
> panels, groceries, inventory, scenes, devices, Home Assistant, AI meal
> suggestions, Supabase project `zloifhakskeyvehlrhqh`). None of that exists.
> This file and the actual file tree are the truth.

---

## 1. What it is

A single Next.js 16 app (`frontend/`, App Router, React 19, Tailwind 4,
Framer Motion 12) backed by Supabase Postgres. No separate backend — the API
is Next.js route handlers. **Live at https://home-psi-pink.vercel.app** —
Vercel project `home`, personal scope `nawaf-haffadhs-projects`, auto-deployed
from `main` on `github.com/Haffadh/home`.

Its job: Abdullah (household staff) sees today's tasks on a tablet and marks
them done or skipped; the family sets the menu, creates tasks, and sends him
requests; a wall-mounted iPad shows an always-on summary.

## 2. The four surfaces

| Route | Who | What it does |
|---|---|---|
| `/panel/abdullah` | Abdullah, Kitchen | Today's tasks, Done/Skip, today's menu, pending family requests. 48px touch targets. **This is the one that must never break.** |
| `/panel/family` | Moeen, Samya, Nawaf, Ahmed, Mariam | Today's menu, send a request to Abdullah, status of own past requests. |
| `/panel/admin` | Admin | Create/edit tasks, set today's menu via dish dropdown. |
| `/dashboard` | wall iPad (no login) | Read-only glanceable summary. Clock, menu, task progress, next 3 tasks. Polls every 60s. |

Supporting routes: `/login` (email + password), `/design` (Hearth style guide,
internal), `/` (redirects by stored role).

Login sends you to your role's default route via `defaultRouteFor()` in
`lib/roles.ts`. Unknown roles land on `/panel/family`.

## 3. Accounts

Seven accounts, all verified logging in after the 2026-08-15 password
rotation. **Passwords are deliberately not in this file or anywhere else in
the repo** — they live in the database as scrypt hashes and in
`CREDENTIALS.local.md` at the repo root, which is gitignored.

| Name | Email | Role | Lands on |
|---|---|---|---|
| Abdullah | `abdullah-1779806878@haffadh.local` | `abdullah` | `/panel/abdullah` |
| Admin | `admin-1779809143@haffadh.local` | `admin` | `/panel/admin` |
| Nawaf | `nawafhaffadh@gmail.com` | `nawaf` | `/panel/family` |
| Moeen | `moeenhaffadh@gmail.com` | `moeen` | `/panel/family` |
| Samya | `drsamyabahram@yahoo.com` | `samya` | `/panel/family` |
| Ahmed | `ahaffadh@gmail.com` | `ahmed` | `/panel/family` |
| Mariam | `mhaffadh@gmail.com` | `mariam` | `/panel/family` |

Nawaf's address changed from `nawaf@haffadh.local` on 2026-08-15; the old one
no longer works. `lib/roles.ts` also defines a `kitchen` role (routes to
Abdullah's panel) with no account behind it.

Passwords are three random lowercase words joined by hyphens — memorable,
and typeable on a phone without fighting autocapitalise. They replaced a
`{Name}#1` convention that was itself committed in `lib/roles.ts`, so anyone
with repo access could log in as anyone.

New accounts go through `POST /api/auth/register`, which requires an admin
token. There is no password-reset flow: changing an existing password means
writing a fresh scrypt hash to the `users` row.

Auth is a custom JWT (scrypt hashing, 30-day access tokens). The browser keeps
`smarthub_token`, `token`, `shh_user_id`, `shh_user_name`, `shh_role` in
localStorage. In development only, `Authorization: Bearer dev-token` maps to
`{id:"dev", role:"admin"}` — it is rejected on a production build.

## 4. Environment variables

`frontend/.env.local` (template committed as `frontend/.env.example`; `.env*`
is otherwise gitignored). The same set must exist on whichever host serves
production.

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project — currently `sdatvpqbhxlfldodzzlp` ("Haffadh Home") |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes, bypasses RLS. Required. |
| `JWT_SECRET` | Signs the access tokens |
| `NEXT_PUBLIC_API_BASE` | Empty = same origin. Leave empty. |
| `DASHBOARD_TOKEN` | Pairs the wall iPad. See below. |
| `ANTHROPIC_API_KEY` | Legacy, unused by any current route |

**Supabase pauses itself** on the free tier after inactivity. A paused project
drops DNS entirely, so NXDOMAIN means paused, *not* deleted. Restore with
`POST /v1/projects/sdatvpqbhxlfldodzzlp/restore` on the Management API
(~3 min); data and keys survive. The CLI token is in the macOS keychain under
service "Supabase CLI" (base64 after a `go-keyring-base64:` prefix), and
`api.supabase.com` needs a non-default User-Agent.

## 5. Pairing the wall iPad

Open `https://home-psi-pink.vercel.app/dashboard?token=<DASHBOARD_TOKEN>`
**once** on the iPad; the token is
then stored locally and the bare `/dashboard` URL works. The summary endpoint
accepts only the `X-Dashboard-Token` header (timing-safe compare) and rejects
JWTs outright — verified in §7.

## 6. API surface

All under `/api/*`; `next.config.mjs` also rewrites the bare paths
(`/daily-tasks`, `/meals`, `/users`, …) so client code fetches without the
prefix.

- `auth/{login,logout,me,refresh,register}` — `register` is admin-only;
  `role-login` was deleted 2026-08-15 (it was an auth bypass, see §9a)
- `daily-tasks`, `daily-tasks/[id]`, `daily-tasks/[id]/{complete,skip}` —
  `GET` needs `?staff_user_id=<int>` or it 400s (by design)
- `meals`, `meals/[id]`
- `requests` (POST), `requests/mine` (GET, scoped to the caller),
  `requests/[id]/done` (PATCH, abdullah/admin only) — all `{ok, data}`
- `urgent_tasks` + `[id]` + `[id]/ack` — legacy; GET/PATCH/DELETE/ack now
  require abdullah/admin. POST is deliberately still open.
- `dashboard/summary` — one response with menu + progress + next 3 + pending
  request count
- `users`, `health`

Family requests reuse the `urgent_tasks` table (migration
`docs/migrations/0003`): `note TEXT`, `status pending|done`, and `submitted_by`
holding the requester's user id as a string.

## 7. Design & motion system ("Hearth")

Light warm theme, one accent (ember `#B4471B` = "needs a person"), olive
`#4A6B2A` for done, one typeface (Figtree), every foreground token ≥ 4.5:1.
Sizes are **px, not rem** on purpose — `globals.css` sets `html{font-size:21px}`
with a breakpoint cascade, so a rem scale would render ~1.31× larger on iPad.
The theme is opt-in per subtree via `.theme-hearth` (applied by `PageShell`),
which is why `/login` is still dark.

Three motion durations, no others: `--dur-h-fast` 180ms (feedback),
`--dur-h-base` 300ms (transitions), `--dur-h-ambient` 500ms (dashboard
crossfades); easings `--ease-h-out` and `--ease-h-in-out`. Framer reads them
through `lib/design/tokens.ts`. Live examples are on `/design`.

**The page-enter is CSS, not Framer** (`.hearth-page-enter` in `globals.css`,
applied by `app/template.tsx`). This is deliberate: the enter fires at mount,
and a JS `prefers-reduced-motion` hook cannot resolve until after the first
paint, so a Framer-driven enter animated for ~350ms even for users who asked
for no motion. CSS is evaluated with the media query already applied.

Everything else stays on Framer and gates on `useInstantMotion()`
(`lib/design/motion.ts`) — which is `prefers-reduced-motion` **or** page
hidden, because Chrome halts rAF for occluded pages and a Framer exit started
then freezes mid-flight and stacks ghosts. Do **not** use Framer's own
`useReducedMotion`. All mutating handlers use synchronous ref-based re-entry
guards; state-driven `disabled` leaves a same-frame double-fire window.

## 8. Verification — 2026-08-15 audit

Run against a real production build (`next build` + `next start`), driven with
puppeteer. Mutation endpoints were stubbed via request interception so the
live household database was left alone. One exception, caught afterwards: the
first family-panel run matched the stub against `/api/requests` while the
client actually fetches the rewritten bare path `/requests`, so one real row
("STUB — not saved") was created and has since been deleted.

| Check | Result |
|---|---|
| Production build + TypeScript | clean, 23 routes (24 before `role-login` was removed) |
| Auth bypasses closed | `role-login` 404, `dev-token` 401 on a production build, `register` 401/403/400 |
| Abdullah's panel after the auth change | logs in, loads, completes a task; guard and exit animation intact |
| All seven accounts | log in and land on the correct panel; a brand-new account driven in the browser reaches `/panel/family` |
| Password rotation | all seven rotated to passphrases and re-verified logging in; all four sampled old passwords rejected |
| **Production, post-deploy** | all seven log in on the live URL and land correctly; old passwords rejected; `role-login` 404, `dev-token` 401, `register` 401; Abdullah's tasks and the wall dashboard both return real data; the four surfaces render in a browser |
| Login → each of the four surfaces | all render on Hearth |
| Page-enter present, normal motion | 300ms fade+rise on every route |
| Page-enter under `prefers-reduced-motion` | **0** painted frames of motion on all 5 routes (was ~19 frames / ~350ms — fixed this pass) |
| Done-task exit (hero moment) | animated normally; instant swap under reduced motion; no ghost cards |
| 4 rapid taps on Done | exactly 1 POST, in both motion modes |
| `dashboard/summary` auth | no token 401, wrong token 401, valid JWT 401, correct token 200 |
| `/urgent_tasks` legacy auth | anon 401, family 403, abdullah 200 |
| `/requests/mine` scoping | returns only the caller's rows |
| Family optimistic request-add | card appears in 18–20ms (not gated on the request), exactly 1 POST, animates normally, instant under reduced motion |
| `/design` demo tiles | replay on tap under normal motion, instant under reduced motion |
| Dashboard soak | 7 min pre-fix and 4 min on the final build: no ghost/stacked text, clock steps every minute, 60s refresh cycle holding, content stable |
| Burn-in drift | steps at exactly t+3min to `translate(5px, 2px)` and eases over 60s |
| Banned motion patterns | no springs, no scale animations, no cascade longer than one delayed element; the legacy `.stagger-*` / `.animate-fade-in` classes in `globals.css` are dead code, referenced by nothing |
| popLayout card reorder | animated normally (125 mid-flight card-frames); **0** under reduced motion — checked by sampling painted transforms, since Framer's FLIP layout animations are invisible to `document.getAnimations()` |
| Client JS, dashboard route | 769 KB uncompressed — in line with the other Hearth routes (770–784 KB); `/login` is 626 KB without Framer. Not an outlier; no lazy-loading needed. |

Three motion defects were found and fixed in this pass:

1. **Reduced motion was ignored on every page enter.** `usePrefersReducedMotion`
   seeded `false` and corrected only in `useEffect` (after first paint), by
   which time Framer had already started the mount animation — and Framer does
   not retarget a running animation when only `transition` changes. Fixed by
   moving the page-enter to CSS.
2. **`/login` ignored reduced motion entirely.** The reduced-motion rule lived
   only in `hearth.css`, scoped to `.theme-hearth`, and `/login` is not on
   Hearth. Added a document-wide rule in `globals.css`.
3. **The `/design` demo tiles animated on mount** for the same reason as (1).
   They now skip the first mount and animate only on tap, which is what the
   tiles are for.

**The general lesson, worth remembering:** any animation that fires *at mount*
cannot be gated by a React hook, because no hook resolves before the first
paint — not even in `useLayoutEffect`, since Framer will not retarget an
animation it has already started when only `transition` changes. Mount-time
motion must be CSS (so the media query is applied by the browser), or must
simply not animate on first mount. Everything triggered by a user action or a
data change is safe on Framer, because `useInstantMotion()` has long settled by
then.

## 9. Deployment

**Live: https://home-psi-pink.vercel.app** (Vercel project `home`). Pushing to
`main` auto-deploys. Verified end-to-end against production 2026-08-15: all
seven accounts log in and reach the right panel, Abdullah's tasks load, the
wall dashboard summary returns data, and all three auth bypasses are closed.

Getting there turned up three traps worth knowing:

- **Vercel env vars are baked in at build time** for anything `NEXT_PUBLIC_*`,
  and injected at deploy time for the rest. Adding or changing a variable does
  nothing to the running deployment — it needs a redeploy
  (`npx vercel redeploy <deployment-url>`, which keeps the Git provenance).
  A deployment that builds fine but fails every login with
  `TypeError: fetch failed` is this: the server has no reachable Supabase URL.
- **Railway is a dead integration.** It is still connected to the repo and
  fires on every push, but it has never once succeeded — it failed in May and
  failed again on the 2026-08-15 push, both times within ~9 seconds. Worth
  disconnecting so it stops posting failed deployments to GitHub.
- **`frontend/.vercel/project.json` points at the wrong project** — the stale
  `smart-home-hub` project, under a team that is no longer accessible. That is
  why `vercel` commands run from `frontend/` fail with "Could not retrieve
  Project Settings". The repo root is linked correctly to `home`.

## 9a. Security — fixed 2026-08-15

Three separate ways to become admin without credentials were found while
auditing before deployment, and all three are fixed (commit `adc76d2`). None
was ever exploited because nothing has been deployed since May.

| Was | Now |
|---|---|
| `POST /api/auth/role-login` returned a valid 30-day JWT for any role — `admin` included — given only the role *name*. No password, no auth header. The minted token was accepted by `/users`, `/urgent_tasks` and `/daily-tasks`. | Route deleted; returns 404. It was dead code — nothing imports `apiFetch`, and each panel has its own `authFetch`. |
| `Bearer dev-token` mapped to `{id:"dev", role:"admin"}` unconditionally, production included. | Gated on `NODE_ENV !== "production"`; returns 401 on a production build. |
| `POST /api/auth/register` was unauthenticated and honoured an arbitrary `role` from the body. | Requires an authenticated admin (401 anonymous, 403 as a family role) and validates the role against the known set (400 otherwise). |

Also fixed 2026-08-15: every password was rotated off the committed
`{Name}#1` convention onto a random three-word passphrase, and the credential
list was removed from `lib/roles.ts`, `README.md` and `CLAUDE.md`. Note that
git *history* still contains the old ones — harmless now they are rotated, but
it is the reason the new ones must never be committed.

Still open, by choice:

- **`POST /urgent_tasks` is unauthenticated**, so request rows can be created
  by anyone who can reach the app.
- The `/dashboard` token is properly handled — header-only, timing-safe
  compare, rejects JWTs.

There is no client-side silent refresh any more, and none is needed: access
tokens last 30 days, so a tablet re-authenticates about monthly. If it is ever
wanted, `/api/auth/refresh` already implements a real rotating refresh-token
flow — store the `refreshToken` that `/auth/login` returns and call it.

## 10. Known rough edges

- **`CLAUDE.md` is stale and actively misleading.** It documents a much larger
  app that was removed in `2319b22`, and names the wrong Supabase project.
- **Test data: mostly cleaned 2026-08-15.** Tasks "Gaynessssss", "Optimistic
  test" and "Skip test" were deactivated (`is_active: false`, the same soft
  delete the admin panel performs, so they are recoverable); requests "Phase 4
  curl check" and "STUB — not saved" were deleted outright. Only "Take out the
  trash" remains active. Requests 1–4 ("Fresh towels please", "Extra blankets
  tonight", "AC filter cleaning", "Water the garden plants") were left alone —
  they read as plausible real requests from the Phase 2 session, all already
  marked done. Delete them if they were seeds.
- **`dashboard/summary` takes ~5–6s.** Supabase is in Sydney and the endpoint
  upserts task instances sequentially. Fine behind a 60s poll; it would need
  batching if it ever became user-facing.
- **Admin's task list shows a plain "Loading…"** where the other surfaces use
  a skeleton that crossfades into content. Cosmetic inconsistency only.
- **The done-task exit runs at 500ms (`ambient`)**, not the 300ms `base` used
  for other transitions. It reads as "set down, not deleted", so it was left
  alone — but it is a deliberate deviation from the token vocabulary.
- **`/login` is still the dark pre-Hearth page.** Never in scope; it is the
  only surface not on the design system.
- **`POST /urgent_tasks` is unauthenticated.** Left open intentionally, but it
  means anyone who can reach the deployment can create a request row.

## 11. Running it

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npx next start  # serve the build
```

Testing notes: the dev server force-reloads the page when it dies, so test
offline behaviour against `next build && next start`. Use
`lsof -ti :3000 -sTCP:LISTEN` — without `-sTCP:LISTEN` it also matches Chrome's
client sockets and killing that list kills Chrome. Reduced-motion end-to-end
testing works with puppeteer-core from `/Users/nawaf/cookie-monsters/node_modules`
plus the Chrome in `~/.cache/puppeteer`, launched with
`--force-prefers-reduced-motion`.
