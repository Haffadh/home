"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; name: string; role: string };
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
  const [users, setUsers] = useState<User[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("12:00");
  const [recurrence, setRecurrence] = useState("daily");
  const [creating, setCreating] = useState(false);

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

  const loadUsers = useCallback(async () => {
    try {
      const res = await authFetch("/users");
      const data = await res.json();
      const list: User[] = Array.isArray(data) ? data : [];
      setUsers(list);
      const abdullah = list.find((u) => u.role === "abdullah") || list[0];
      if (abdullah && staffId === null) setStaffId(abdullah.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }, [authFetch, staffId]);

  const loadTasks = useCallback(async () => {
    if (staffId === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/daily-tasks?staff_user_id=${staffId}&date=${todayISO()}`);
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
  }, [authFetch, staffId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || staffId === null) return;
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
          staff_user_id: staffId,
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

  const staffOptions = useMemo(
    () => users.filter((u) => u.role !== "admin"),
    [users]
  );

  return (
    <div className="min-h-screen px-4 py-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin · Tasks</h1>
        <button onClick={logout} className="text-xs text-white/40 hover:text-white/80 transition">
          Sign out
        </button>
      </header>

      <section className="mb-6">
        <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">Staff</label>
        <select
          value={staffId ?? ""}
          onChange={(e) => setStaffId(parseInt(e.target.value, 10))}
          className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-white outline-none"
        >
          {staffOptions.length === 0 && <option value="">No staff users found</option>}
          {staffOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role}) · #{u.id}
            </option>
          ))}
        </select>
      </section>

      <form
        onSubmit={createTask}
        className="space-y-3 bg-slate-900/60 border border-white/5 rounded-2xl p-4 mb-6"
      >
        <h2 className="text-base font-medium">New task</h2>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Take out the trash)"
          className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-white"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-white"
        />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">Start</label>
            <input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">End</label>
            <input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Repeats</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-white/10 px-2 py-2 text-white"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || staffId === null}
          className="rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {creating ? "Creating…" : "Add task"}
        </button>
      </form>

      <section>
        <h2 className="text-base font-medium mb-3">Today's tasks</h2>
        {loading && <p className="text-white/50">Loading…</p>}
        {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}
        {!loading && tasks.length === 0 && <p className="text-white/50 text-sm">No tasks.</p>}
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-xl bg-slate-900/60 border border-white/10 px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{t.title}</p>
                <p className="text-xs text-white/40">
                  {t.window_start}–{t.window_end} · {t.recurrence}
                </p>
              </div>
              <button
                onClick={() => deleteTask(t.id)}
                className="text-xs text-rose-400/80 hover:text-rose-300 transition"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
