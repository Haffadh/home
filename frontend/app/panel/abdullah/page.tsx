"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Meal = { id: number; date: string; meal_type: "breakfast" | "lunch" | "dinner"; name: string };

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AbdullahPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [menu, setMenu] = useState<Record<"breakfast" | "lunch" | "dinner", string | null>>({
    breakfast: null,
    lunch: null,
    dinner: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const date = todayISO();

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
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
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem("shh_user_id");
      const userName = localStorage.getItem("shh_user_name") || "";
      setStaffName(userName);
      if (!userId) {
        setError("No user ID — please log in again.");
        setLoading(false);
        return;
      }
      const [tasksRes, mealsRes] = await Promise.all([
        authFetch(`/daily-tasks?staff_user_id=${userId}&date=${date}`),
        authFetch(`/meals?date=${date}`),
      ]);
      const tasksData = await tasksRes.json();
      if (!tasksRes.ok || !tasksData.ok) {
        setError(tasksData.error || "Failed to load tasks");
        setLoading(false);
        return;
      }
      setTasks(tasksData.tasks || []);

      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        const next: Record<"breakfast" | "lunch" | "dinner", string | null> = {
          breakfast: null,
          lunch: null,
          dinner: null,
        };
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

  async function markComplete(id: number) {
    const res = await authFetch(`/daily-tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ date }),
    });
    if (res.ok) void load();
  }

  async function markSkipped(id: number) {
    const res = await authFetch(`/daily-tasks/${id}/skip`, {
      method: "POST",
      body: JSON.stringify({ date }),
    });
    if (res.ok) void load();
  }

  function logout() {
    localStorage.removeItem("smarthub_token");
    localStorage.removeItem("token");
    localStorage.removeItem("shh_user_id");
    localStorage.removeItem("shh_user_name");
    localStorage.removeItem("shh_role");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Today's Tasks</h1>
          <p className="text-sm text-white/50">
            {staffName ? `${staffName} · ` : ""}{date}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-xs text-white/40 hover:text-white/80 transition"
        >
          Sign out
        </button>
      </header>

      {!loading && (menu.breakfast || menu.lunch || menu.dinner) && (
        <section className="mb-6 bg-slate-900/60 border border-white/5 rounded-2xl p-4">
          <h2 className="text-sm font-medium text-white/70 mb-2">Today's Menu</h2>
          <ul className="space-y-1 text-sm">
            {(["breakfast", "lunch", "dinner"] as const).map((slot) =>
              menu[slot] ? (
                <li key={slot} className="flex gap-2">
                  <span className="capitalize text-white/50 w-20">{slot}:</span>
                  <span className="text-white/90">{menu[slot]}</span>
                </li>
              ) : null
            )}
          </ul>
        </section>
      )}

      {loading && <p className="text-white/50">Loading…</p>}
      {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="text-white/50">No tasks for today.</p>
      )}

      <ul className="space-y-3">
        {tasks.map((task) => {
          const status = task.instance?.status || "pending";
          const isDone = status === "done";
          const isSkipped = status === "skipped";
          return (
            <li
              key={task.id}
              className={`rounded-2xl p-4 border transition ${
                isDone
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : isSkipped
                  ? "bg-amber-500/5 border-amber-500/20 opacity-60"
                  : "bg-slate-900/60 border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className={`text-base font-medium ${isDone ? "line-through text-white/60" : ""}`}>
                    {task.title}
                  </h2>
                  <p className="text-xs text-white/40 mt-1">
                    {task.window_start} – {task.window_end}
                    {task.room ? ` · ${task.room}` : ""}
                  </p>
                  {task.notes && (
                    <p className="text-sm text-white/60 mt-2 whitespace-pre-wrap">{task.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!isDone && (
                    <button
                      onClick={() => markComplete(task.id)}
                      className="rounded-lg bg-emerald-500/80 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition"
                    >
                      Done
                    </button>
                  )}
                  {!isSkipped && !isDone && (
                    <button
                      onClick={() => markSkipped(task.id)}
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm font-medium text-white/80 transition"
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
