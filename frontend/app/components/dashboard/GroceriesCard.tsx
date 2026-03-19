"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { useRealtimeTable } from "../../../lib/useRealtimeTable";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import * as groceriesService from "../../../lib/services/groceries";
import type { GroceryRow } from "../../../lib/services/groceries";
import { ensureInventoryAuditTaskIfNeeded } from "../../../lib/inventory/auditTask";
import { runGroceryIntelligence } from "../../../lib/inventory/runGroceryIntelligence";

type GroceriesCardProps = { maxItems?: number };

export default function GroceriesCard({ maxItems = 6 }: GroceriesCardProps) {
  const [groceries, setGroceries] = useState<GroceryRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const loadGroceries = useCallback(async () => {
    try {
      const data = await groceriesService.fetchGroceriesFromApi();
      setGroceries(data ?? []);
      ensureInventoryAuditTaskIfNeeded().catch(() => {});
      runGroceryIntelligence().catch(() => {});
    } catch {
      setGroceries([]);
    }
  }, []);

  useEffect(() => {
    loadGroceries();
  }, [loadGroceries]);

  useRealtimeTable("groceries", loadGroceries);

  const pending = groceries.filter((i) => !i.is_done);
  const shown = maxItems ? pending.slice(0, maxItems) : pending;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding || !getSupabaseClient()) return;
    setAdding(true);
    try {
      await groceriesService.addGrocery({ title, requested_by: "family" });
      setNewTitle("");
      await loadGroceries();
    } catch {
      // keep form state
    } finally {
      setAdding(false);
    }
  }

  async function toggleBought(id: string, current: boolean) {
    if (!getSupabaseClient()) return;
    setGroceries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_done: !current } : i))
    );
    try {
      await groceriesService.updateGrocery(id, { is_done: !current });
      await loadGroceries();
    } catch {
      setGroceries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_done: current } : i))
      );
    }
  }

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
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[0.8125rem] text-white/95 placeholder:text-white/40 border border-white/10 bg-[#0f172a]/50 backdrop-blur-[12px] focus:outline-none focus:border-white/15 focus:ring-2 focus:ring-[rgba(99,179,237,0.2)]"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim() || !getSupabaseClient()}
          className="shrink-0 rounded-xl bg-[#1e293b]/60 hover:bg-[#1e293b]/80 border border-white/10 px-3 py-2 text-[0.8125rem] font-medium text-white/90 disabled:opacity-50 transition"
        >
          {adding ? "…" : "Add"}
        </button>
      </form>

      {shown.length === 0 ? (
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
                onClick={() => toggleBought(i.id, i.is_done)}
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md border border-white/20 text-[0.75rem] transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-[#0f172a]/50 disabled:opacity-50"
              >
                {i.is_done ? "✓" : ""}
              </button>
              <span className="text-[0.8125rem] text-white/90 truncate flex-1">{i.title}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
