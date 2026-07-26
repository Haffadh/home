"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Coffee,
  CookingPot,
  ForkKnife,
  SkipForward,
  Sun,
} from "@phosphor-icons/react";
import { Badge, Button, Card, CardLabel, PageShell } from "@/app/components/ui";
import { DUR, EASE } from "@/lib/design/tokens";

/* ── Types mirror the API exactly. The contract is unchanged from before the
   redesign: same endpoints, same payloads, same localStorage keys. ───────── */

type MealType = "breakfast" | "lunch" | "dinner";

type Meal = { id: number; date: string; meal_type: MealType; name: string };

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

type Menu = Record<MealType, string | null>;

const EMPTY_MENU: Menu = { breakfast: null, lunch: null, dinner: null };

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

/* Icon carries the meaning, the word confirms it — Abdullah is not a native
   English speaker, so neither is left to do the job alone. */
const MEAL_ICON: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: ForkKnife,
  dinner: CookingPot,
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

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

      const [tasksRes, mealsRes] = await Promise.all([
        authFetch(`/daily-tasks?staff_user_id=${userId}&date=${date}`),
        authFetch(`/meals?date=${date}`),
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
        const next: Menu = { ...EMPTY_MENU };
        for (const m of (mealsData.meals || []) as Meal[]) {
          if (m.meal_type in next) next[m.meal_type] = m.name;
        }
        setMenu(next);
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

  const hasMenu = MEAL_ORDER.some((slot) => menu[slot]);

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
      {!loading && hasMenu && (
        <Card className="mb-h8">
          <CardLabel>Food today</CardLabel>
          <ul className="mt-h4 flex flex-col gap-h4">
            {MEAL_ORDER.map((slot) => {
              const name = menu[slot];
              if (!name) return null;
              const Icon = MEAL_ICON[slot];
              return (
                <li key={slot} className="flex items-start gap-h4">
                  <Icon
                    size={24}
                    aria-hidden
                    className="mt-[2px] shrink-0 text-hearth-ink-3"
                  />
                  <div className="min-w-0">
                    <p className="text-h9 text-hearth-ink-3">
                      {MEAL_LABEL[slot]}
                    </p>
                    <p className="text-h5 font-medium text-hearth-ink">{name}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
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
