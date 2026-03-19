# Architecture & Spec Implementation Notes

## Current Stack (as of this document)

The app **does not use Supabase**. It uses:

- **Backend:** Fastify (Node.js) + PostgreSQL (`pg`) + WebSockets for real-time
- **Frontend:** Next.js 16, React 19, Zustand (HouseBrain store with `localStorage` persist)
- **Real-time:** Backend broadcasts via WebSocket (`broadcast(fastify, "tasks_updated", ...)` etc.); frontend has `RealtimeContext` for events like `tasks_updated`, `urgent_updated`, `groceries_updated`
- **Auth:** Backend has JWT/auth routes and role-based middleware
- **Devices:** Tuya/Smart Life via `tuyaClient.js` (requires `TUYA_*` env vars)
- **AI:** Optional OpenAI usage in `openaiClient.js` (e.g. How-to) when `OPENAI_API_KEY` is set

So: **tasks, meals, and groceries are currently backed by (1) HouseBrain Zustand store with localStorage persist, and (2) some backend APIs (e.g. `/api/tasks`, `/urgent_tasks`, `/groceries`).** There is no Supabase client or Supabase real-time in the codebase.

---

## What Was Implemented (this pass)

1. **Meals – Portion number fix (#2)**  
   - Replaced the numeric portion input with a **dropdown**: 1, 2, 3, 4, 5, 6, and **Custom**.  
   - If **Custom** is selected, a separate numeric input is shown; value is validated as a positive integer.  
   - Implemented in `HouseControlPanel.tsx` via a `PortionDropdown` component used in the meal selector modal.

2. **Room view task-add glitch (#3)**  
   - On task add in `RoomPanel`, we now **save and restore `window.scrollY`/`window.scrollX`** and **blur the active element** after submit to avoid scroll jump and focus shift that caused the top of the page to disappear on iPad.

3. **Task display – time-blocked awareness (#8)**  
   - Task rows in **HouseBrainTasksCard** and **RoomPanel** now show, when present:  
     **start time – end time · duration** and **assignee/createdBy** (with “Urgent” when applicable).  
   - Uses existing optional `startTime`, `endTime`, `durationMinutes`, `createdBy` on the HouseBrain `Task` type.

4. **No Supabase changes**  
   - No Supabase schema or client was added; the above work is compatible with the existing Fastify + HouseBrain setup.

---

## What the Full 20-Point Spec Would Require

The spec you provided assumes **Supabase + Vercel** and describes many features that are not yet in the codebase. To implement it fully you would need to:

### Data & real-time

- **Introduce Supabase:** Add `@supabase/supabase-js`, define tables for tasks, meals, groceries, inventory, notifications, etc., and replace or mirror current HouseBrain/API usage with Supabase client + **Supabase Realtime** subscriptions.  
- **Environment variables:** e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally service role for server-side).  
- **Sync strategy:** Decide whether to keep HouseBrain as a client cache that syncs to Supabase or to drive the UI directly from Supabase (with optional optimistic updates).  
- **De-duplication:** Handle “local update + subscription echo” so inserts/updates/deletes and reorders do not double-apply or conflict (e.g. single source of truth, idempotent handlers, or version/sequence fields).

### Features that need backend / Supabase / new work

- **#1 Real-time across panels:** Implement with Supabase Realtime (or keep/expand current WebSocket approach and ensure all mutations go through one layer).  
- **#4 Task creation flow:** Preferred time, duration presets, AI scheduling, recurring (daily/weekdays/monthly/custom) – needs backend or Edge function for scheduling and possibly OpenAI for “slot finding.”  
- **#5 Urgent tasks + conflict:** Abdullah’s “current schedule” and “busy until” logic, modals (“It’s URGENT!” / “It can wait”), and pushing tasks – needs schedule state and backend/Realtime.  
- **#6 Skip task:** Options (keep empty / replace another / bring forward) and recalculating downstream times – needs scheduling engine and persistence.  
- **#7 Reorder = swap time slots:** Persist order and recompute start/end times; sync via Supabase or API.  
- **#9 Meals/tasks/grocery propagation:** Enforce “meals only in Kitchen/Abdullah,” “tasks in relevant views,” “grocery everywhere” via Supabase (or current API) and clear read rules.  
- **#10 Inventory + weekly audit:** New tables (inventory, categories, audit runs), “Large Shopping” detection (e.g. >20 items in a time window), auto-creation of 1-hour Inventory Audit task 7 days later.  
- **#11 AI-assisted inventory/meals:** Suggestions from “missing for meal,” “low stock,” “expiring,” “meal from inventory,” “purchase only if audit says not enough” – needs OpenAI (or other) API and inventory/meals data.  
- **#12 Grocery PDF:** Server or client PDF generation (e.g. jsPDF or server-side lib), with item name, category, suggested quantity, reason, linked meal; branded styling.  
- **#13 Notifications:** New notifications table + Realtime, types (Urgent, Reminder, Expiration, Completed, Skipped, Inventory audit due), expiration reminders (3 days before + on day), UI (bell, full page, subtle animation).  
- **#14 Device cards:** More placeholder devices per room and device-type-specific controls (lights dimming, AC temp/fan, blinds) – can be UI-only; real behavior needs Tuya (or other) integration.  
- **#15 Tuya integration:** Current code has `tuyaClient.js`; harden device sync and state updates and keep architecture modular for later ecosystems.  
- **#16 Music mode:** 10-hour loop (e.g. built-in or asset), Play/Pause, timer badge – can be client-only for demo.  
- **#17–19 Mobile, typography, long-press:** Largely front-end; some done (time/assignee on tasks, room scroll fix); long-press details/edit/skip can be added on existing task components.

---

## Environment / Keys (current and for full spec)

**Currently used (see README):**

- Backend: `TUYA_*`, `DB_*`, optional `OPENAI_API_KEY`, `PORT`
- Frontend: `NEXT_PUBLIC_API_BASE` (or similar) pointing at Fastify

**For full Supabase-based spec:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (Optional) Supabase service role key for server/Edge
- Real Tuya credentials for #15
- OpenAI (or other) API key for #11 and any AI scheduling in #4/#5

---

## Summary

- **Current:** Fastify + PostgreSQL + Zustand (HouseBrain) + WebSockets; **no Supabase**.  
- **Implemented this pass:** (1) Meals portion dropdown 1–6 + Custom, (2) Room panel scroll/focus fix on task add, (3) Task display of start/end time, duration, and assignee where data exists.  
- **Full 20-point spec:** Requires introducing Supabase (or equivalent) for shared state and real-time, new tables and APIs for inventory, notifications, scheduling, and AI, plus Tuya hardening and several UI additions (notifications, PDF, music mode, device controls). This doc and the codebase are a starting point for that work.
