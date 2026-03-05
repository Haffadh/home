"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GlassCard from "./GlassCard";
import { useRealtimeEvent } from "../../context/RealtimeContext";

import { getApiBase, getActorHeaders, withActorBody } from "../../lib/api";

const API_BASE = getApiBase();

type UrgentTask = {
  id: number;
  title: string;
  acknowledged?: boolean;
  created_at?: string;
  /** Display name of who submitted; if API provides it */
  submitted_by?: string;
};

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "—";
  }
}

type UrgentTasksCardProps = { canEditTasks?: boolean; readOnly?: boolean; simplified?: boolean };

export default function UrgentTasksCard({ canEditTasks = true, readOnly = false, simplified = false }: UrgentTasksCardProps = {}) {
  const [tasks, setTasks] = useState<UrgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/urgent_tasks`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onMidnight = () => load();
    window.addEventListener("midnight-rollover", onMidnight);
    return () => window.removeEventListener("midnight-rollover", onMidnight);
  }, [load]);

  useRealtimeEvent("urgent_updated", load);

  async function acknowledge(id: number) {
    setAckingId(id);
    try {
      const res = await fetch(`${API_BASE}/urgent_tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({ acknowledged: true })),
      });
      if (res.ok) await load();
    } finally {
      setAckingId(null);
    }
  }

  const pending = tasks.filter((t) => !t.acknowledged);
  const shown = pending.slice(0, 5);

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">
          Urgent Tasks
        </h2>
        {canEditTasks && (
          <Link
            href="/family"
            className="text-[0.8125rem] font-medium text-white/60 transition-all duration-300 ease-out hover:scale-[1.02] hover:text-blue-300"
          >
            Add →
          </Link>
        )}
      </div>
      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-[0.8125rem] text-white/45">No urgent tasks. Add from Family.</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((t) => (
            <li
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] px-3.5 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 ${simplified ? "py-4 min-h-[56px]" : ""}`}
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] font-medium text-white/90 truncate">{t.title}</p>
                <p className="text-[0.6875rem] text-white/45 tabular-nums mt-0.5">
                  {formatTime(t.created_at)}
                </p>
                <p className="text-[0.6875rem] text-white/40 mt-0.5">
                  Submitted by {t.submitted_by ?? "—"}
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => acknowledge(t.id)}
                  disabled={ackingId !== null}
                  className={`shrink-0 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 py-1.5 text-[0.75rem] font-medium text-amber-300/95 transition-all duration-300 ease-out hover:bg-amber-500/25 hover:scale-[1.02] disabled:opacity-50 ${simplified ? "min-h-[44px] px-4 py-2.5 text-[0.875rem]" : ""}`}
                >
                  {ackingId === t.id ? "…" : "Done"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
