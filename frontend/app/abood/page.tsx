"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:3001";

type Task = { id: number; title: string; is_done: boolean };
type UrgentTask = { id: number; title: string; acknowledged?: boolean };

type ToastStatus = "idle" | "loading" | "success" | "error";
type ToastState = { open: boolean; status: ToastStatus; title: string; subtitle?: string; emoji?: string };

function DynamicIslandToast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const width = toast.status === "loading" ? 420 : 460;
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-full px-4 pointer-events-none">
      <AnimatePresence mode="wait">
        {toast.open ? (
          <motion.div
            key={`${toast.status}-${toast.title}`}
            initial={{ opacity: 0, y: -18, scale: 0.92, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, scale: 0.92, filter: "blur(6px)" }}
            className="mx-auto pointer-events-auto"
            style={{ width: "fit-content" }}
          >
            <motion.div
              animate={{ width, borderRadius: 999 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="relative overflow-hidden bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl px-5 py-3 grid grid-cols-[32px_1fr_32px] items-center gap-3 select-none"
            >
              <div className="relative w-8 h-8 flex items-center justify-center text-lg">
                {toast.status === "loading" ? (
                  <motion.div
                    className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/90"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <span>{toast.emoji}</span>
                )}
              </div>
              <div className="relative flex-1 min-w-[220px] flex flex-col items-center justify-center text-center leading-tight">
                <p className="text-sm font-semibold text-white">{toast.title}</p>
                <p className="text-xs text-white/70 mt-0.5 min-h-[14px]">{toast.subtitle || ""}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="relative w-8 h-8 flex items-center justify-center text-white/55 hover:text-white/90 transition"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

async function getHowTo(type: "task" | "meal", title: string, context?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/ai/howto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, title, context }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "AI unavailable");
  return String(data.answer || "").trim();
}

export default function AboodPage() {
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, status: "idle", title: "", subtitle: "", emoji: "" });
  const [loading, setLoading] = useState(true);
  const [tasksToday, setTasksToday] = useState<Task[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTask[]>([]);

  const [menu, setMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    step: "menu" | "edit" | "confirm_delete" | "loading" | "answer" | "error";
    entity: "task" | "urgent_task";
    itemId: number;
    title: string;
    editValue?: string;
    answer?: string;
  }>({ open: false, x: 0, y: 0, step: "menu", entity: "task", itemId: 0, title: "" });

  function clearToastTimer() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
  }
  function openToast(next: Omit<ToastState, "open">) {
    clearToastTimer();
    setToast({ open: true, ...next });
  }
  function closeToast() {
    clearToastTimer();
    setToast((t) => ({ ...t, open: false, status: "idle" }));
  }
  function autoClose(ms = 2000) {
    clearToastTimer();
    toastTimerRef.current = setTimeout(closeToast, ms);
  }

  async function refresh() {
    setLoading(true);
    try {
      const [t, u] = await Promise.allSettled([
        fetch(`${API_BASE}/tasks/today/1`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${API_BASE}/urgent_tasks`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setTasksToday(t.status === "fulfilled" && Array.isArray(t.value) ? t.value : []);
      setUrgentTasks(u.status === "fulfilled" && Array.isArray(u.value) ? u.value : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleTask(id: number, current: boolean) {
    const prev = tasksToday;
    setTasksToday((p) => p.map((t) => (t.id === id ? { ...t, is_done: !current } : t)));
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: !current }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setTasksToday(prev);
    }
  }

  async function toggleUrgent(id: number) {
    const prev = urgentTasks;
    const cur = urgentTasks.find((t) => t.id === id);
    const next = !Boolean(cur?.acknowledged);
    setUrgentTasks((p) => p.map((t) => (t.id === id ? ({ ...t, acknowledged: next } as any) : t)));
    try {
      const res = await fetch(`${API_BASE}/urgent_tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: next }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setUrgentTasks(prev);
    }
  }

  async function saveEdit() {
    const t = (menu.editValue || "").trim();
    if (!t) return;
    openToast({ status: "loading", title: "Updating…", subtitle: "", emoji: "✍️" });
    try {
      const path = menu.entity === "urgent_task" ? `/urgent_tasks/${menu.itemId}` : `/tasks/${menu.itemId}`;
      const res = await fetch(`${API_BASE}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMenu((p) => ({ ...p, open: false }));
      await refresh();
      openToast({ status: "success", title: "Updated", subtitle: "", emoji: "✍️" });
      autoClose(1800);
    } catch {
      openToast({ status: "error", title: "Failed to update", subtitle: "", emoji: "❌" });
      autoClose(2200);
      setMenu((p) => ({ ...p, step: "error" }));
    }
  }

  async function doDelete() {
    openToast({ status: "loading", title: "Deleting…", subtitle: "", emoji: "🗑️" });
    try {
      const path = menu.entity === "urgent_task" ? `/urgent_tasks/${menu.itemId}` : `/tasks/${menu.itemId}`;
      const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setMenu((p) => ({ ...p, open: false }));
      await refresh();
      openToast({ status: "success", title: "Deleted", subtitle: "", emoji: "🗑️" });
      autoClose(1800);
    } catch {
      openToast({ status: "error", title: "Failed to delete", subtitle: "", emoji: "❌" });
      autoClose(2200);
      setMenu((p) => ({ ...p, step: "error" }));
    }
  }

  async function runHowTo() {
    openToast({ status: "loading", title: "How to…", subtitle: "Thinking…", emoji: "🛠️" });
    setMenu((p) => ({ ...p, step: "loading", answer: undefined }));
    try {
      const answer = await getHowTo("task", menu.title, menu.entity === "urgent_task" ? "Urgent task" : "Today task");
      setMenu((p) => ({ ...p, step: "answer", answer }));
      closeToast();
    } catch {
      setMenu((p) => ({ ...p, step: "error" }));
      openToast({ status: "error", title: "AI unavailable", subtitle: "Please try again.", emoji: "❌" });
      autoClose(2200);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#07090d]" />
      <DynamicIslandToast toast={toast} onClose={closeToast} />

      {menu.open ? (
        <div className="fixed inset-0 z-[9998]">
          <button type="button" aria-label="Close" onClick={() => setMenu((p) => ({ ...p, open: false }))} className="absolute inset-0" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="fixed z-[9999] w-[320px] max-w-[92vw] rounded-2xl border border-white/10 bg-black/75 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            style={{
              left: Math.max(16, Math.min(menu.x, window.innerWidth - 16)),
              top: Math.max(16, Math.min(menu.y, window.innerHeight - 16)),
              transform: "translate(-50%, 14px)",
            }}
          >
            <div className="text-sm font-semibold text-white/90 truncate">{menu.title}</div>
            <div className="mt-1 text-xs text-white/60">Menu</div>

            {menu.step === "menu" ? (
              <div className="mt-3 space-y-2">
                <button onClick={runHowTo} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/10">
                  How to?
                </button>
                <button
                  onClick={() => setMenu((p) => ({ ...p, step: "edit", editValue: p.editValue ?? p.title }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => setMenu((p) => ({ ...p, step: "confirm_delete" }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-white/10"
                >
                  Delete
                </button>
              </div>
            ) : menu.step === "edit" ? (
              <div className="mt-3 space-y-2">
                <input
                  value={menu.editValue || ""}
                  onChange={(e) => setMenu((p) => ({ ...p, editValue: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/10">
                    Save
                  </button>
                  <button onClick={() => setMenu((p) => ({ ...p, step: "menu" }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
                    Back
                  </button>
                </div>
              </div>
            ) : menu.step === "confirm_delete" ? (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-white/70">Delete this item?</div>
                <div className="flex gap-2">
                  <button onClick={doDelete} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-white/10">
                    Delete
                  </button>
                  <button onClick={() => setMenu((p) => ({ ...p, step: "menu" }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
                    Cancel
                  </button>
                </div>
              </div>
            ) : menu.step === "answer" ? (
              <div className="mt-3 space-y-2">
                <div className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/85">{menu.answer}</div>
              </div>
            ) : menu.step === "loading" ? (
              <div className="mt-3 text-xs text-white/70">Loading…</div>
            ) : (
              <div className="mt-3 text-xs text-white/70">AI is currently unavailable. Please try again.</div>
            )}
          </motion.div>
        </div>
      ) : null}

      <div className="mx-auto max-w-md px-4 py-6">
        <div className="text-2xl font-extrabold tracking-tight">Abood</div>
        <div className="mt-1 text-sm text-white/55">Tasks, urgent, and meals.</div>

        <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="text-sm font-semibold text-white/85">Today</div>
          {loading ? (
            <div className="mt-3 text-sm text-white/55">Loading…</div>
          ) : tasksToday.length === 0 ? (
            <div className="mt-3 text-sm text-white/55">No tasks.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {tasksToday.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTask(t.id, t.is_done)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ open: true, x: e.clientX, y: e.clientY, step: "menu", entity: "task", itemId: t.id, title: t.title, editValue: t.title });
                  }}
                  className="w-full rounded-[18px] border border-white/10 bg-black/25 px-3 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white/90">{t.title}</div>
                    <div className="text-white/70">{t.is_done ? "✓" : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="text-sm font-semibold text-white/85">Urgent</div>
          {loading ? (
            <div className="mt-3 text-sm text-white/55">Loading…</div>
          ) : urgentTasks.length === 0 ? (
            <div className="mt-3 text-sm text-white/55">Nothing urgent.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {urgentTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleUrgent(t.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      open: true,
                      x: e.clientX,
                      y: e.clientY,
                      step: "menu",
                      entity: "urgent_task",
                      itemId: t.id,
                      title: t.title,
                      editValue: t.title,
                    });
                  }}
                  className="w-full rounded-[18px] border border-white/10 bg-black/25 px-3 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white/90">{t.title}</div>
                    <div className="text-white/70">{t.acknowledged ? "✓" : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

