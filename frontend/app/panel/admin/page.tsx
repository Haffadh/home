"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash } from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Card,
  CardLabel,
  Input,
  PageShell,
  Section,
  Select,
  Textarea,
} from "@/app/components/ui";
import { DUR, EASE } from "@/lib/design/tokens";
import { useInstantMotion } from "@/lib/design/motion";
import { MenuEditor } from "@/app/components/MenuEditor";

type DailyTask = {
  id: number;
  title: string;
  notes: string | null;
  window_start: string;
  window_end: string;
  recurrence: string;
  recurrence_days?: number[] | null;
  start_date: string;
  end_date: string | null;
  room: string | null;
  is_active: boolean;
  staff_user_id: number;
};

const RECURRENCE_OPTIONS = ["daily", "weekly", "none"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminPage() {
  const router = useRouter();
  const reduceMotion = useInstantMotion();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("12:00");
  const [recurrence, setRecurrence] = useState("daily");
  const [creating, setCreating] = useState(false);
  /* Synchronous re-entry guard — state-driven disabling leaves a same-frame
     double-fire window; a ref closes it. */
  const creatingRef = useRef(false);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = localStorage.getItem("smarthub_token") || localStorage.getItem("token");
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

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/daily-tasks?date=${todayISO()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load tasks");
        return;
      }
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const res = await authFetch("/daily-tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          window_start: windowStart,
          window_end: windowEnd,
          recurrence,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Create failed");
        return;
      }
      setTitle("");
      setNotes("");
      void loadTasks();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    const res = await authFetch(`/daily-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
    if (res.ok) void loadTasks();
  }

  function logout() {
    ["smarthub_token", "token", "shh_user_id", "shh_user_name", "shh_role"].forEach((k) =>
      localStorage.removeItem(k)
    );
    router.replace("/login");
  }

  return (
    <PageShell
      title="Admin"
      subtitle="Tasks and today's menu"
      width="wide"
      action={
        <Button variant="quiet" size="sm" onClick={logout}>
          Sign out
        </Button>
      }
    >
      {/* ── Today's menu ──────────────────────────────────────────────────── */}
      <MenuEditor date={todayISO()} authFetch={authFetch} className="mb-h8" />

      {/* ── New task ──────────────────────────────────────────────────────── */}
      <Card className="mb-h8">
        <CardLabel>New task</CardLabel>
        <form onSubmit={createTask} className="mt-h4 flex flex-col gap-h4">
          <Input
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Take out the trash"
          />
          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <div className="grid gap-h4 md:grid-cols-3">
            <Input
              label="Start"
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
            <Input
              label="End"
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
            <Select
              label="Repeats"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Button
              type="submit"
              loading={creating}
              disabled={creating}
              icon={<Plus size={18} weight="bold" />}
            >
              Add task
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Today's tasks ─────────────────────────────────────────────────── */}
      <Section heading="Today's tasks">
        {loading && <p className="text-h7 text-hearth-ink-3">Loading…</p>}
        {error && (
          <Card tone="accent" elevation="flat" className="mb-h4">
            <p className="text-h7 font-medium text-hearth-accent">{error}</p>
          </Card>
        )}
        {!loading && tasks.length === 0 && (
          <Card tone="sunk" elevation="flat">
            <p className="py-h4 text-center text-h7 text-hearth-ink-3">
              No tasks.
            </p>
          </Card>
        )}
        {!loading && tasks.length > 0 && (
          <ul className="flex flex-col gap-h2">
            <AnimatePresence initial={false} mode="popLayout">
              {tasks.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={false}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 6 }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: DUR.base, ease: EASE.inOut }
                  }
                  className="flex items-center justify-between gap-h4 rounded-h-md bg-hearth-surface px-h5 py-h4 shadow-h-e1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-h7 font-medium text-hearth-ink">
                      {t.title}
                    </p>
                    <p className="h-tnum text-h9 text-hearth-ink-3">
                      {t.window_start}–{t.window_end} · {t.recurrence}
                    </p>
                  </div>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => void deleteTask(t.id)}
                    icon={<Trash size={16} />}
                  >
                    Delete
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
