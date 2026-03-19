"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import { useRealtimeEvent } from "../../context/RealtimeContext";

import { getApiBase, withActorBody } from "../../../lib/api";
import { formatTimeOnly } from "../../../lib/scheduling/formatTaskTimeRange";

type UrgentTask = {
  id: number;
  title: string;
  acknowledged?: boolean;
  created_at?: string;
  submitted_by?: string;
  priority?: number; // 1=normal, 2=high, 3=critical
};

type UrgentTasksCardProps = { canEditTasks?: boolean; readOnly?: boolean; simplified?: boolean };

export default function UrgentTasksCard({ canEditTasks = true, readOnly = false, simplified = false }: UrgentTasksCardProps = {}) {
  const [tasks, setTasks] = useState<UrgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState(1);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(true);
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 8);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApiBase("/api/urgent_tasks", { cache: "no-store" });
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onMidnight = () => load();
    window.addEventListener("midnight-rollover", onMidnight);
    return () => window.removeEventListener("midnight-rollover", onMidnight);
  }, [load]);

  useRealtimeEvent("urgent_updated", load);

  async function handleAddTask() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await getApiBase("/api/urgent_tasks", {
        method: "POST",
        body: withActorBody({ title, priority: newPriority }),
      });
      setNewTitle("");
      setNewPriority(1);
      setShowAdd(false);
      await load();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function toggleAcknowledge(task: UrgentTask) {
    if (readOnly) return;
    const next = !task.acknowledged;
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, acknowledged: next } : t));
    try {
      await getApiBase(`/api/urgent_tasks/${task.id}`, {
        method: "PATCH",
        body: withActorBody({ acknowledged: next }),
      });
    } catch {
      await load();
    }
  }

  // Sort: pending first, then acknowledged (done) at bottom
  const sorted = [...tasks].sort((a, b) => {
    if (a.acknowledged && !b.acknowledged) return 1;
    if (!a.acknowledged && b.acknowledged) return -1;
    return 0;
  });
  const pending = sorted.filter((t) => !t.acknowledged);
  const done = sorted.filter((t) => t.acknowledged);
  const all = [...pending, ...done];

  return (
    <GlassCard className="animate-fade-in-up opacity-0 overflow-hidden" style={{ animationDelay: "0.1s" }}>
      <div className="flex flex-col min-h-0 flex-1 gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white/90">Urgent Tasks</h2>
          {canEditTasks && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="text-[0.8125rem] font-medium text-white/60 transition-all duration-300 ease-out hover:scale-[1.02] hover:text-blue-300"
            >
              {showAdd ? "Cancel" : "Add +"}
            </button>
          )}
        </div>
        {showAdd && (
          <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What needs doing?" autoFocus
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.875rem] text-white/90 placeholder:text-white/30 outline-none focus:border-white/20"
              />
              <button type="submit" disabled={adding || !newTitle.trim()}
                className="shrink-0 rounded-xl bg-amber-500/20 border border-amber-400/25 px-3 py-2 text-[0.8125rem] font-medium text-amber-300/95 transition hover:bg-amber-500/30 disabled:opacity-40">
                {adding ? "…" : "Add"}
              </button>
            </div>
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map((p) => (
                <button key={p} type="button" onClick={() => setNewPriority(p)}
                  className={`flex-1 rounded-lg py-1.5 text-[0.6875rem] font-medium transition border ${
                    newPriority === p
                      ? p === 3 ? "bg-rose-500/20 border-rose-400/30 text-rose-300"
                        : p === 2 ? "bg-amber-500/20 border-amber-400/30 text-amber-300"
                        : "bg-white/10 border-white/20 text-white/80"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40"
                  }`}>
                  {p === 3 ? "🔴 Critical" : p === 2 ? "🟡 High" : "⚪ Normal"}
                </button>
              ))}
            </div>
          </form>
        )}
        {loading ? (
          <p className="text-[0.8125rem] text-white/45">Loading…</p>
        ) : all.length === 0 ? (
          <p className="text-[0.8125rem] text-white/45">No urgent tasks.</p>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden" style={{ maxHeight: all.length > 4 ? "calc(4 * 3.75rem + 3.5 * 0.625rem + 1.5rem)" : undefined }}>
            <ul ref={scrollRef as React.RefObject<HTMLUListElement>} onScroll={handleScroll} className="space-y-2.5 overflow-y-auto min-h-0 h-full no-scrollbar">
              {/* Pending tasks */}
              {pending.map((t) => {
                const prio = t.priority ?? 1;
                const borderColor = prio === 3 ? "rgba(244,63,94,0.2)" : prio === 2 ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)";
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggleAcknowledge(t)}
                      className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out text-left hover:-translate-y-0.5 ${simplified ? "py-4 min-h-[56px]" : ""}`}
                      style={{
                        borderColor,
                        background: prio === 3
                          ? "linear-gradient(180deg, rgba(244,63,94,0.08) 0%, rgba(244,63,94,0.02) 100%)"
                          : prio === 2
                            ? "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)"
                            : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                      }}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${prio === 3 ? "bg-rose-400" : prio === 2 ? "bg-amber-400" : "bg-white/30"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.875rem] font-medium text-white/90 truncate">{t.title}</p>
                        <p className="text-[0.6875rem] text-white/45 tabular-nums mt-0.5">
                          {formatTimeOnly(t.created_at)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
              {/* Done tasks — faded at bottom */}
              {done.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggleAcknowledge(t)}
                    className={`w-full flex items-center gap-3 rounded-2xl border border-white/[0.04] px-3.5 py-2.5 backdrop-blur-xl transition-all text-left opacity-35 scale-[0.98] ${simplified ? "py-4 min-h-[56px]" : ""}`}
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] font-medium text-white/60 truncate line-through">{t.title}</p>
                      <p className="text-[0.6875rem] text-white/30 tabular-nums mt-0.5">
                        {formatTimeOnly(t.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {all.length > 4 && fadeTop && (
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
            {all.length > 4 && fadeBottom && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
