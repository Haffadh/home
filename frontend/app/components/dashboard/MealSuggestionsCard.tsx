"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { getApiBase, withActorBody } from "../../../lib/api";
import * as runMealIntelligence from "../../../lib/meals/runMealIntelligence";
import type { MealSuggestionResult } from "../../../lib/meals/runMealIntelligence";

export default function MealSuggestionsCard() {
  const [suggestions, setSuggestions] = useState<MealSuggestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await runMealIntelligence.runMealIntelligence();
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCookThis(s: MealSuggestionResult) {
    setActingId(s.meal);
    try {
      await getApiBase("/api/meals", {
        method: "POST",
        body: withActorBody({ type: "lunch", dish: s.meal, portions: 2 }),
      });
      await load();
    } catch {
      // keep list
    } finally {
      setActingId(null);
    }
  }

  async function handleAddMissing(s: MealSuggestionResult) {
    if (!s.missingIngredients.length) return;
    setActingId(s.meal);
    try {
      for (const ing of s.missingIngredients) {
        await getApiBase("/api/groceries", {
          method: "POST",
          body: withActorBody({ title: ing, requestedBy: "family" }),
        });
      }
      await load();
    } catch {
      // keep list
    } finally {
      setActingId(null);
    }
  }

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white/90">Suggested Meals</h2>
        {loading ? (
          <p className="text-[0.8125rem] text-white/45">Loading…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-[0.8125rem] text-white/45">No suggestions. Add inventory to get meal ideas.</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const busy = actingId === s.meal;
              return (
                <li
                  key={s.meal}
                  className="rounded-2xl border border-white/[0.06] p-4 backdrop-blur-xl"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                  }}
                >
                  <p className="text-[0.9375rem] font-medium text-white/90">{s.meal}</p>
                  <p className="text-[0.8125rem] text-white/55 mt-0.5">{s.reason}</p>
                  {s.missingIngredients.length > 0 && (
                    <p className="text-[0.75rem] text-white/45 mt-1">
                      Missing: {s.missingIngredients.join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleCookThis(s)}
                      disabled={busy}
                      className="rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-50 px-3 py-1.5 text-[0.75rem] font-medium text-white transition"
                    >
                      {busy ? "…" : "Cook this"}
                    </button>
                    {s.missingIngredients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAddMissing(s)}
                        disabled={busy}
                        className="rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 px-3 py-1.5 text-[0.75rem] font-medium text-white/90 transition"
                      >
                        Add missing to groceries
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
