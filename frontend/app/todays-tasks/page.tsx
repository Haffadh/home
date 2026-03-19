"use client";

import { useCallback, useEffect, useState } from "react";
import { getMergedTasks } from "../components/dashboard/GatheringModal";
import { getApiBase } from "../../lib/api";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { getSupabaseClient } from "@/lib/supabaseClient";
import * as tasksService from "@/lib/services/tasks";
import { taskRowsToUI, timeWindowToStartEnd, type UITask } from "@/lib/adapters/tasks";
import { formatTaskTimeRange } from "@/lib/scheduling/formatTaskTimeRange";

const TIME_WINDOWS = [
  { id: "morning", label: "Morning (8am–12pm)" },
  { id: "afternoon", label: "Afternoon (12pm–5pm)" },
  { id: "evening", label: "Evening (5pm–10pm)" },
] as const;

type Task = UITask;

function formatDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const glassCardStyle = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)" as const,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 4px 24px -4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.04)",
};

function glassCardHover(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.background = "rgba(255, 255, 255, 0.07)";
  el.style.borderColor = "rgba(255, 255, 255, 0.1)";
  el.style.boxShadow =
    "0 12px 40px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 40px -8px rgba(99, 179, 237, 0.12)";
}

function glassCardLeave(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.background = "rgba(255, 255, 255, 0.05)";
  el.style.borderColor = "rgba(255, 255, 255, 0.08)";
  el.style.boxShadow = "0 4px 24px -4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.04)";
}

// Edit task modal
function EditTaskModal({
  task,
  onClose,
  onSave,
}: {
  task: Task;
  onClose: () => void;
  onSave: (payload: { title: string; date: string; timeWindow: string; durationMinutes: number }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [timeWindow, setTimeWindow] = useState<string>(() => {
    const t = new Date(task.startTime).getHours();
    if (t < 12) return "morning";
    if (t < 17) return "afternoon";
    return "evening";
  });
  const [durationMinutes, setDurationMinutes] = useState(task.durationMinutes);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-3xl p-6 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 shadow-xl transition hover:bg-[#0f172a]/80 animate-fade-in-up"
        style={glassCardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white/95 mb-4">Edit task</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
            />
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
            />
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Time window</label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
            >
              {TIME_WINDOWS.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#0f172a]">
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Duration (min)</label>
            <input
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.875rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition active:scale-[0.97]">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ title, date, timeWindow, durationMinutes })}
            className="flex-1 rounded-xl bg-[rgba(99,179,237,0.2)] border border-[rgba(99,179,237,0.3)] px-4 py-2.5 text-[0.875rem] font-medium text-white/95 hover:bg-[rgba(99,179,237,0.25)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// How-to modal (AI steps)
function HowToModal({ taskTitle, onClose }: { taskTitle: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getApiBase("/api/ai/howto", {
          method: "POST",
          body: { title: taskTitle, context: "Today's task", type: "task" },
        });
        if (cancelled) return;
        const answer = (data as { answer?: string })?.answer;
        const err = (data as { error?: string })?.error;
        if (answer) setAnswer(answer);
        else setError(err || "Could not load steps");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskTitle]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-3xl p-6 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 shadow-xl max-h-[80vh] overflow-auto animate-fade-in-up"
        style={glassCardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white/95 mb-2">How to: {taskTitle}</h3>
        {loading && <p className="text-[0.8125rem] text-white/50">Loading steps…</p>}
        {error && <p className="text-[0.8125rem] text-rose-300/90">{error}</p>}
        {answer && (
          <div className="text-[0.875rem] text-white/85 whitespace-pre-wrap leading-relaxed">{answer}</div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.875rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition active:scale-[0.97]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function TodaysTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDate, setAddDate] = useState(() => todayKey());
  const [addTimeWindow, setAddTimeWindow] = useState("morning");
  const [addDuration, setAddDuration] = useState(60);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [howToTaskTitle, setHowToTaskTitle] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!getSupabaseClient()) {
        setTasks([]);
        setError("Supabase not configured");
        return;
      }
      const rows = await tasksService.fetchTasks();
      const uiTasks = taskRowsToUI(rows);
      setTasks(getMergedTasks(uiTasks) as Task[]);
    } catch (e) {
      setTasks([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onMidnight = () => loadTasks();
    const onGatheringAdded = () => loadTasks();
    window.addEventListener("midnight-rollover", onMidnight);
    window.addEventListener("gathering-tasks-added", onGatheringAdded);
    return () => {
      window.removeEventListener("midnight-rollover", onMidnight);
      window.removeEventListener("gathering-tasks-added", onGatheringAdded);
    };
  }, [loadTasks]);

  useRealtimeTable("tasks", loadTasks);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const title = addTitle.trim();
    if (!title || !getSupabaseClient()) return;
    try {
      const { start_time, end_time } = timeWindowToStartEnd(addDate, addTimeWindow, addDuration);
      await tasksService.createTask({ title, start_time, end_time, duration: addDuration });
      setAddTitle("");
      setAddDate(todayKey());
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add task");
    }
  }

  async function markComplete(id: string) {
    if (!getSupabaseClient()) return;
    setCompletingId(id);
    try {
      await tasksService.completeTask(id);
      await loadTasks();
    } finally {
      setCompletingId(null);
    }
  }

  async function skipTask(id: string) {
    if (!getSupabaseClient()) return;
    try {
      await tasksService.deleteTask(id);
      await loadTasks();
    } catch {
      // ignore
    }
  }

  async function saveEdit(
    id: string,
    payload: { title: string; date: string; timeWindow: string; durationMinutes: number }
  ) {
    if (!getSupabaseClient()) return;
    try {
      const { start_time, end_time } = timeWindowToStartEnd(payload.date, payload.timeWindow, payload.durationMinutes);
      await tasksService.updateTask(id, {
        title: payload.title,
        start_time,
        end_time,
        duration: payload.durationMinutes,
      });
      setEditTask(null);
      await loadTasks();
    } catch {
      // ignore
    }
  }

  const today = todayKey();
  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");
  const todayPending = pending.filter((t) => t.date === today);
  const upcomingPending = pending.filter((t) => t.date > today);
  const todayCompleted = completed.filter((t) => t.date === today);
  const otherCompleted = completed.filter((t) => t.date !== today);

  return (
    <div className="p-4 md:p-8 text-[#e8ecf0]">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl md:text-3xl font-semibold text-white/95 tracking-tight">
            Today&apos;s Tasks
          </h1>
          <p className="text-[0.9375rem] text-white/55 mt-1.5 tracking-tight">
            Manage your tasks for today and upcoming days
          </p>
        </div>

        <form
          onSubmit={handleAddTask}
          className="rounded-3xl p-6 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 shadow-xl transition hover:bg-[#0f172a]/80 mb-6 space-y-4 animate-fade-in-up stagger-1 opacity-0"
          style={glassCardStyle}
          onMouseEnter={glassCardHover}
          onMouseLeave={glassCardLeave}
        >
          <h2 className="text-[0.9375rem] font-semibold text-white/90 tracking-tight">Add Task</h2>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 placeholder:text-white/40 border border-white/10 bg-[#0f172a]/50 backdrop-blur-[12px] focus:outline-none focus:border-white/15 focus:ring-2 focus:ring-[rgba(99,179,237,0.2)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
              />
            </div>
            <div>
              <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Time window</label>
              <select
                value={addTimeWindow}
                onChange={(e) => setAddTimeWindow(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
              >
                {TIME_WINDOWS.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#0f172a]">{w.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1.5 uppercase tracking-wider">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              value={addDuration}
              onChange={(e) => setAddDuration(parseInt(e.target.value, 10) || 15)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#1e293b]/60 hover:bg-[#1e293b]/80 border border-white/10 px-4 py-2.5 text-[0.875rem] font-medium text-white/95 transition-all duration-200"
          >
            Add Task
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-[0.8125rem] text-rose-200/95 mb-5 animate-fade-in">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-[0.8125rem] text-white/50">Loading…</p>
        ) : (
          <div className="space-y-8">
            {todayPending.length > 0 && (
              <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.05s" }}>
                <h2 className="text-[0.6875rem] font-semibold text-white/60 uppercase tracking-wider mb-3">Today</h2>
                <ul className="space-y-2.5">
                  {todayPending.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-white/[0.08] p-4 transition-all duration-200 hover:border-white/[0.1]"
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                        e.currentTarget.style.boxShadow = "0 0 24px -8px rgba(99, 179, 237, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white/95 text-[0.9375rem] tracking-tight">{t.title}</div>
                          <div className="mt-2 text-[0.6875rem] text-white/50 tabular-nums">
                            {formatTaskTimeRange(t.startTime, t.endTime ?? new Date(new Date(t.startTime).getTime() + (t.durationMinutes ?? 60) * 60000).toISOString(), t.durationMinutes)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setHowToTaskTitle(t.title)}
                            className="rounded-lg border border-white/10 bg-[#0f172a]/70 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white/70 hover:bg-[#0f172a]/80"
                          >
                            How to?
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTask(t)}
                            className="rounded-lg border border-white/10 bg-[#0f172a]/70 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white/70 hover:bg-[#0f172a]/80"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => skipTask(t.id)}
                            className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[0.6875rem] font-medium text-amber-300/90 hover:bg-amber-500/20"
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            onClick={() => markComplete(t.id)}
                            disabled={completingId === t.id}
                            className="rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2 text-[0.75rem] font-medium text-emerald-300/95 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50"
                          >
                            {completingId === t.id ? "…" : "✓ Tick"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {upcomingPending.length > 0 && (
              <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
                <h2 className="text-[0.6875rem] font-semibold text-white/60 uppercase tracking-wider mb-3">Upcoming</h2>
                <ul className="space-y-2.5">
                  {upcomingPending.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-white/[0.08] p-4 flex items-start justify-between gap-4"
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white/95 text-[0.9375rem] tracking-tight">{t.title}</div>
                        <div className="mt-2 text-[0.6875rem] text-white/50 tabular-nums">
                          {t.date} · {formatTaskTimeRange(t.startTime, t.endTime ?? new Date(new Date(t.startTime).getTime() + (t.durationMinutes ?? 60) * 60000).toISOString(), t.durationMinutes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setHowToTaskTitle(t.title)} className="rounded-lg border border-white/10 bg-[#0f172a]/70 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white/70 hover:bg-[#0f172a]/80">How to?</button>
                        <button type="button" onClick={() => setEditTask(t)} className="rounded-lg border border-white/10 bg-[#0f172a]/70 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white/70 hover:bg-[#0f172a]/80">Edit</button>
                        <button type="button" onClick={() => skipTask(t.id)} className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[0.6875rem] font-medium text-amber-300/90">Skip</button>
                        <button type="button" onClick={() => markComplete(t.id)} disabled={completingId === t.id} className="rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2 text-[0.75rem] font-medium text-emerald-300/95 hover:bg-emerald-500/25 disabled:opacity-50">✓ Tick</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(todayCompleted.length > 0 || otherCompleted.length > 0) && (
              <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.15s" }}>
                <h2 className="text-[0.6875rem] font-semibold text-white/60 uppercase tracking-wider mb-3">Completed</h2>
                <ul className="space-y-2.5">
                  {[...todayCompleted, ...otherCompleted].map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-white/[0.06] p-4 opacity-75 transition-opacity duration-300"
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                      }}
                    >
                      <div className="font-medium text-white/60 text-[0.9375rem] line-through tracking-tight">{t.title}</div>
                      <div className="mt-2 text-[0.6875rem] text-white/45 tabular-nums">
                        {t.date} · {formatTaskTimeRange(t.startTime, t.endTime ?? new Date(new Date(t.startTime).getTime() + (t.durationMinutes ?? 60) * 60000).toISOString(), t.durationMinutes)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tasks.length === 0 && !loading && (
              <div className="rounded-3xl border border-white/10 p-8 text-center text-[0.8125rem] text-white/50 bg-[#0f172a]/70 backdrop-blur-xl shadow-xl">
                No tasks yet. Add one above or use Gathering Mode on the dashboard.
              </div>
            )}
          </div>
        )}
      </div>

      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(payload) => saveEdit(editTask.id, payload)}
        />
      )}
      {howToTaskTitle && (
        <HowToModal taskTitle={howToTaskTitle} onClose={() => setHowToTaskTitle(null)} />
      )}
    </div>
  );
}
