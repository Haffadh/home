"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, SkipForward, Sun } from "@phosphor-icons/react";
import { Badge, Button, Card, PageShell } from "@/app/components/ui";
import {
  MenuCard,
  menuFromMeals,
  hasAnyMeal,
  EMPTY_MENU,
  type Meal,
  type Menu,
} from "@/app/components/MenuCard";
import { DUR, EASE } from "@/lib/design/tokens";

/* ── Types mirror the API exactly. The contract is unchanged from before the
   redesign: same endpoints, same payloads, same localStorage keys. ───────── */

type TaskInstance = {
  status: "pending" | "done" | "skipped";
  completed_at?: string | null;
};

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  window_start: string;
  window_end: string;
  room?: string | null;
  category?: string | null;
  instance?: TaskInstance | null;
};

/* A family request, straight off urgent_tasks. submitted_by is the requester's
   user id as text; the name is resolved from /users. */
type FamilyRequest = {
  id: number;
  title: string;
  note: string | null;
  status: "pending" | "done";
  submitted_by: string | null;
  created_at: string;
};

type UserRow = { id: number | string; name: string; role: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusOf(task: Task): TaskInstance["status"] {
  return task.instance?.status || "pending";
}

/** "07:12" from an ISO timestamp, for the finished list. */
function clockOf(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AbdullahPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<FamilyRequest[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [menu, setMenu] = useState<Menu>(EMPTY_MENU);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const [date] = useState(todayISO);

  useEffect(() => setMounted(true), []);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token =
        localStorage.getItem("smarthub_token") || localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        throw new Error("no token");
      }
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      if (res.status === 401) {
        router.replace("/login");
        throw new Error("unauthorized");
      }
      return res;
    },
    [router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem("shh_user_id");
      const userName = localStorage.getItem("shh_user_name") || "";
      setStaffName(userName);
      if (!userId) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }

      /* Requests and names are best-effort — if either fetch fails, the daily
         task list still has to render exactly as before. */
      const [tasksRes, mealsRes, requestsRes, usersRes] = await Promise.all([
        authFetch(`/daily-tasks?staff_user_id=${userId}&date=${date}`),
        authFetch(`/meals?date=${date}`),
        authFetch("/urgent_tasks").catch(() => null),
        authFetch("/users").catch(() => null),
      ]);

      const tasksData = await tasksRes.json();
      if (!tasksRes.ok || !tasksData.ok) {
        setError(tasksData.error || "Could not load your tasks.");
        setLoading(false);
        return;
      }
      setTasks(tasksData.tasks || []);

      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        setMenu(menuFromMeals((mealsData.meals || []) as Meal[]));
      }

      if (requestsRes?.ok) {
        const rows = (await requestsRes.json()) as FamilyRequest[];
        setRequests(
          Array.isArray(rows) ? rows.filter((r) => r.status === "pending") : []
        );
      }

      if (usersRes?.ok) {
        const users = (await usersRes.json()) as UserRow[];
        const names: Record<string, string> = {};
        if (Array.isArray(users)) {
          for (const u of users) names[String(u.id)] = u.name;
        }
        setRequesterNames(names);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, date]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Optimistic update with rollback — unchanged in behaviour from the previous
     version, only the surrounding UI is new. The tap must feel instant. */
  async function setInstanceStatus(id: number, action: "complete" | "skip") {
    const nextStatus: TaskInstance["status"] =
      action === "complete" ? "done" : "skipped";
    let previousInstance: TaskInstance | null | undefined;

    setBusyId(id);
    setTasks((current) =>
      current.map((t) => {
        if (t.id !== id) return t;
        previousInstance = t.instance ?? null;
        return {
          ...t,
          instance: {
            ...(t.instance ?? {}),
            status: nextStatus,
            completed_at:
              action === "complete" ? new Date().toISOString() : null,
          },
        };
      })
    );

    try {
      const res = await authFetch(`/daily-tasks/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save. Please try again.");
      }
      setError(null);
    } catch (err) {
      // Put the card back exactly where it was.
      setTasks((current) =>
        current.map((t) =>
          t.id === id ? { ...t, instance: previousInstance ?? null } : t
        )
      );
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusyId(null);
    }
  }

  /* Same optimistic contract as the task buttons: the card leaves instantly,
     and is put back in its place if the save fails. */
  async function markRequestDone(id: number) {
    let removed: FamilyRequest | undefined;
    let removedAt = 0;

    setBusyRequestId(id);
    setRequests((current) => {
      const index = current.findIndex((r) => r.id === id);
      if (index >= 0) {
        removed = current[index];
        removedAt = index;
      }
      return current.filter((r) => r.id !== id);
    });

    try {
      const res = await authFetch(`/requests/${id}/done`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save. Please try again.");
      }
      setError(null);
    } catch (err) {
      setRequests((current) => {
        if (!removed) return current;
        const next = [...current];
        next.splice(Math.min(removedAt, next.length), 0, removed);
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusyRequestId(null);
    }
  }

  function requesterLabel(req: FamilyRequest): string {
    if (req.submitted_by && requesterNames[req.submitted_by]) {
      return requesterNames[req.submitted_by];
    }
    return "Family";
  }

  function logout() {
    ["smarthub_token", "token", "shh_user_id", "shh_user_name", "shh_role"].forEach(
      (k) => localStorage.removeItem(k)
    );
    router.replace("/login");
  }

  const todo = useMemo(
    () => tasks.filter((t) => statusOf(t) === "pending"),
    [tasks]
  );
  const finished = useMemo(
    () => tasks.filter((t) => statusOf(t) !== "pending"),
    [tasks]
  );
  const doneCount = useMemo(
    () => tasks.filter((t) => statusOf(t) === "done").length,
    [tasks]
  );

  const hasMenu = hasAnyMeal(menu);

  const prettyDate = mounted
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  /* Motion is required here by the brief: a finished task must leave the list
     gracefully rather than blinking out. Framer drives inline styles, so the
     reduced-motion CSS blanket in hearth.css cannot reach it — this hook is
     what honours the preference for these animations. */
  const exitTransition = reduceMotion
    ? { duration: 0 }
    : { duration: DUR.slow, ease: EASE.out };

  return (
    <PageShell
      title="Today"
      subtitle={prettyDate || undefined}
      width="panel"
      action={
        <Button variant="quiet" size="sm" onClick={logout}>
          Sign out
        </Button>
      }
    >
      {/* ── Progress ──────────────────────────────────────────────────────── */}
      {!loading && tasks.length > 0 && (
        <div className="mb-h8">
          <div className="flex items-baseline justify-between gap-h4">
            <p className="flex items-baseline gap-h2">
              <span className="h-tnum text-h3 font-semibold tracking-[-0.02em] text-hearth-ink">
                {doneCount}
              </span>
              <span className="text-h6 text-hearth-ink-3">
                of {tasks.length} done
              </span>
            </p>
            {staffName && (
              <span className="text-h8 text-hearth-ink-3">{staffName}</span>
            )}
          </div>
          <div
            className="mt-h3 h-h2 w-full overflow-hidden rounded-h-pill bg-hearth-sunk"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={tasks.length}
            aria-label="Tasks done today"
          >
            <motion.div
              className="h-full rounded-h-pill bg-hearth-accent"
              initial={false}
              animate={{
                width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%`,
              }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: DUR.slow, ease: EASE.out }
              }
            />
          </div>
        </div>
      )}

      {/* ── Menu ──────────────────────────────────────────────────────────── */}
      {!loading && hasMenu && <MenuCard menu={menu} className="mb-h8" />}

      {/* ── From the family — pending requests, above the daily tasks. The
           accent surface is the "needs a person" signal; when there are none,
           the group does not exist at all. ─────────────────────────────────── */}
      {!loading && requests.length > 0 && (
        <section className="mb-h8" aria-label="From the family">
          <h2 className="mb-h4 text-h8 font-medium text-hearth-ink-3">
            From the family
          </h2>
          <ul className="flex flex-col gap-h5">
            <AnimatePresence initial={false} mode="popLayout">
              {requests.map((req) => (
                <motion.li
                  key={req.id}
                  layout
                  initial={false}
                  exit={
                    reduceMotion
                      ? { opacity: 0, pointerEvents: "none" }
                      : { opacity: 0, scale: 0.97, pointerEvents: "none" }
                  }
                  transition={exitTransition}
                  className="rounded-h-lg border border-hearth-accent/25 bg-hearth-accent-soft p-h5 shadow-h-e1"
                >
                  <div className="flex items-start justify-between gap-h4">
                    <h3 className="text-h5 font-semibold text-hearth-ink">
                      {req.title}
                    </h3>
                    <Badge tone="accent">{requesterLabel(req)}</Badge>
                  </div>

                  {req.note && (
                    <p className="mt-h3 whitespace-pre-wrap text-h7 text-hearth-ink-2">
                      {req.note}
                    </p>
                  )}

                  <div className="mt-h5">
                    <Button
                      size="lg"
                      fullWidth
                      loading={busyRequestId === req.id}
                      onClick={() => void markRequestDone(req.id)}
                      icon={<Check size={22} weight="bold" />}
                    >
                      Done
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <Card tone="accent" elevation="flat" className="mb-h6">
          <p className="text-h7 font-medium text-hearth-accent">{error}</p>
        </Card>
      )}

      {/* ── Loading skeleton — matches the real card shape so nothing jumps ── */}
      {loading && (
        <ul className="flex flex-col gap-h5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-[168px] animate-pulse rounded-h-lg border border-hearth-line bg-hearth-surface"
            />
          ))}
        </ul>
      )}

      {/* ── To do ─────────────────────────────────────────────────────────── */}
      {!loading && (
        <ul className="flex flex-col gap-h5">
          <AnimatePresence initial={false} mode="popLayout">
            {todo.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={false}
                /* pointerEvents is dropped the instant the exit starts. While
                   a card is animating out it is still in the DOM, and under
                   popLayout it is absolutely positioned over the list — so
                   without this a second tap on the ghost would fire a
                   duplicate POST. Matters most when Safari backgrounds the
                   tab mid-exit and freezes the animation until it returns. */
                exit={
                  reduceMotion
                    ? { opacity: 0, pointerEvents: "none" }
                    : { opacity: 0, scale: 0.97, pointerEvents: "none" }
                }
                transition={exitTransition}
                className="rounded-h-lg border border-hearth-line bg-hearth-surface p-h5 shadow-h-e1"
              >
                <div className="flex items-start justify-between gap-h4">
                  <h2 className="text-h5 font-semibold text-hearth-ink">
                    {task.title}
                  </h2>
                  {task.room && <Badge tone="neutral">{task.room}</Badge>}
                </div>

                <p className="h-tnum mt-h1 text-h8 text-hearth-ink-3">
                  {task.window_start} - {task.window_end}
                </p>

                {task.notes && (
                  <p className="mt-h3 whitespace-pre-wrap text-h7 text-hearth-ink-2">
                    {task.notes}
                  </p>
                )}

                <div className="mt-h5 flex gap-h3">
                  <Button
                    size="lg"
                    className="flex-1"
                    loading={busyId === task.id}
                    onClick={() => void setInstanceStatus(task.id, "complete")}
                    icon={<Check size={22} weight="bold" />}
                  >
                    Done
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    disabled={busyId === task.id}
                    onClick={() => void setInstanceStatus(task.id, "skip")}
                    icon={<SkipForward size={22} />}
                  >
                    Skip
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* ── Empty states ──────────────────────────────────────────────────── */}
      {!loading && !error && tasks.length === 0 && (
        <Card tone="sunk" elevation="flat">
          <div className="flex flex-col items-center gap-h3 py-h10 text-center">
            <Sun size={32} aria-hidden className="text-hearth-ink-3" />
            <p className="text-h5 font-medium text-hearth-ink">
              No tasks today
            </p>
          </div>
        </Card>
      )}

      {!loading && tasks.length > 0 && todo.length === 0 && (
        <Card tone="done" elevation="flat">
          <div className="flex flex-col items-center gap-h3 py-h10 text-center">
            <Check size={32} weight="bold" aria-hidden className="text-hearth-done" />
            <p className="text-h5 font-medium text-hearth-ink">
              All finished. Thank you.
            </p>
          </div>
        </Card>
      )}

      {/* ── Finished ──────────────────────────────────────────────────────── */}
      {!loading && finished.length > 0 && (
        <section className="mt-h10">
          <h2 className="mb-h4 text-h8 font-medium text-hearth-ink-3">
            Finished
          </h2>
          <ul className="flex flex-col gap-h2">
            <AnimatePresence initial={false}>
              {finished.map((task) => {
                const isDone = statusOf(task) === "done";
                const at = clockOf(task.instance?.completed_at);
                return (
                  <motion.li
                    key={task.id}
                    layout
                    initial={
                      reduceMotion ? false : { opacity: 0, y: -8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: DUR.base, ease: EASE.out, delay: 0.12 }
                    }
                    className="flex items-center gap-h4 rounded-h-md bg-hearth-surface px-h5 py-h4"
                  >
                    {isDone ? (
                      <Check
                        size={20}
                        weight="bold"
                        aria-hidden
                        className="shrink-0 text-hearth-done"
                      />
                    ) : (
                      <SkipForward
                        size={20}
                        aria-hidden
                        className="shrink-0 text-hearth-ink-3"
                      />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate text-h7 ${
                        isDone
                          ? "text-hearth-ink-2 line-through decoration-hearth-ink-3/40"
                          : "text-hearth-ink-3"
                      }`}
                    >
                      {task.title}
                    </span>
                    {isDone && at ? (
                      <span className="h-tnum shrink-0 text-h9 text-hearth-ink-3">
                        {at}
                      </span>
                    ) : (
                      !isDone && <Badge tone="muted">Skipped</Badge>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </PageShell>
  );
}
