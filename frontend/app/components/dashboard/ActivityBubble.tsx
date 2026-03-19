"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "../../../lib/api";
import { useRealtimeEvent } from "../../context/RealtimeContext";
import GlassCard from "./GlassCard";

type ActivityEntry = {
  id: number;
  ts: string;
  actor_role: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload_json: Record<string, unknown> | null;
};

export default function ActivityBubble() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApiBase("/api/activity?limit=50");
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent("tasks_updated", load);
  useRealtimeEvent("urgent_updated", load);
  useRealtimeEvent("groceries_updated", load);
  useRealtimeEvent("devices_updated", load);

  function formatTs(ts: string) {
    try {
      const d = new Date(ts);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      return sameDay
        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return "—";
    }
  }

  function label(row: ActivityEntry) {
    const who = row.actor_name || row.actor_role || "—";
    const action = row.action || "did something";
    const entity = row.entity_type || "";
    return `${who} · ${action} ${entity}`.trim();
  }

  return (
    <GlassCard className="animate-fade-in-up opacity-0 flex flex-col overflow-hidden" style={{ animationDelay: "0.2s" }}>
      <div className="mb-3 shrink-0">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">Activity</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1 max-h-[220px]">
        {loading ? (
          <p className="text-[0.8125rem] text-white/45">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-[0.8125rem] text-white/45">No activity yet.</p>
        ) : (
          entries.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/[0.06] px-3 py-2 text-[0.75rem] text-white/80"
              style={{
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <span className="text-white/45 tabular-nums">{formatTs(row.ts)}</span>
              <span className="mx-1.5">·</span>
              <span>{label(row)}</span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
