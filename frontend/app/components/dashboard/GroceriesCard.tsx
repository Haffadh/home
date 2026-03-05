"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { getApiBase, getActorHeaders, withActorBody } from "../../lib/api";
import { useRealtimeEvent } from "../../context/RealtimeContext";

const API_BASE = getApiBase();

type Grocery = {
  id: number;
  title: string;
  requested_by: string;
  is_done?: boolean;
  created_at?: string;
};

type GroceriesCardProps = { maxItems?: number };

export default function GroceriesCard({ maxItems = 6 }: GroceriesCardProps) {
  const [items, setItems] = useState<Grocery[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groceries`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent("groceries_updated", load);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/groceries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({ title, requestedBy: "family" })),
      });
      if (res.ok) {
        setNewTitle("");
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleBought(item: Grocery) {
    setTogglingId(item.id);
    try {
      const res = await fetch(`${API_BASE}/groceries/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({ bought: !item.is_done })),
      });
      if (res.ok) await load();
    } finally {
      setTogglingId(null);
    }
  }

  const pending = items.filter((i) => !i.is_done);
  const shown = maxItems ? pending.slice(0, maxItems) : pending;

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">
          Groceries
        </h2>
      </div>

      <form onSubmit={addItem} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add item…"
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[0.8125rem] text-white/95 placeholder:text-white/40 border border-white/[0.08] bg-white/[0.05] backdrop-blur-[12px] focus:outline-none focus:border-white/15 focus:ring-2 focus:ring-[rgba(99,179,237,0.2)]"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="shrink-0 rounded-xl bg-white/10 hover:bg-white/15 border border-white/[0.1] px-3 py-2 text-[0.8125rem] font-medium text-white/90 disabled:opacity-50"
        >
          {adding ? "…" : "Add"}
        </button>
      </form>

      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-[0.8125rem] text-white/45">No pending groceries.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] px-3 py-2 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <button
                type="button"
                onClick={() => toggleBought(i)}
                disabled={togglingId !== null}
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 text-[0.75rem] transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-white/10 disabled:opacity-50"
              >
                {togglingId === i.id ? "…" : i.is_done ? "✓" : ""}
              </button>
              <span className="text-[0.8125rem] text-white/90 truncate flex-1">{i.title}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
