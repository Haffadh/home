"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { getApiBase, withActorBody } from "../../../lib/api";
import { useRealtimeEvent } from "../../context/RealtimeContext";
import { runMealIntelligenceForSlot } from "../../../lib/meals/runMealIntelligence";
import type { MealSuggestionResult } from "../../../lib/meals/runMealIntelligence";
import { BREAKFAST_ITEMS, LUNCH_ITEMS, DINNER_ITEMS } from "../../../data/menu";

type MealSlot = "breakfast" | "lunch" | "dinner";
const MENU_BY_SLOT: Record<MealSlot, readonly string[]> = {
  breakfast: BREAKFAST_ITEMS, lunch: LUNCH_ITEMS, dinner: DINNER_ITEMS,
};

type MealData = {
  id: string;
  type: MealSlot;
  dish: string | null;
  drink: string | null;
  portions: number;
  requested_by?: string | null;
};

const SECTIONS: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

type MealsCardProps = { readOnly?: boolean; canEditTasks?: boolean };

export default function MealsCard({ readOnly = false }: MealsCardProps = {}) {
  const [meals, setMeals] = useState<Record<MealSlot, MealData | null>>({
    breakfast: null,
    lunch: null,
    dinner: null,
  });
  const [suggestions, setSuggestions] = useState<Record<MealSlot, MealSuggestionResult | null>>({ breakfast: null, lunch: null, dinner: null });
  const [expanded, setExpanded] = useState<MealSlot | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showPicker, setShowPicker] = useState<MealSlot | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadMeals = useCallback(async () => {
    try {
      const data = (await getApiBase("/api/meals", { cache: "no-store" })) as {
        ok?: boolean;
        meals?: MealData[];
      };
      const rows = data?.meals ?? [];
      const bySlot: Record<MealSlot, MealData | null> = {
        breakfast: null,
        lunch: null,
        dinner: null,
      };
      for (const row of rows) {
        const slot = row.type as MealSlot;
        if (slot in bySlot && !bySlot[slot]) bySlot[slot] = row;
      }
      setMeals(bySlot);
    } catch {
      // keep current state
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const [b, l, d] = await Promise.all([
        runMealIntelligenceForSlot("breakfast"),
        runMealIntelligenceForSlot("lunch"),
        runMealIntelligenceForSlot("dinner"),
      ]);
      setSuggestions({
        breakfast: b[0] ?? null,
        lunch: l[0] ?? null,
        dinner: d[0] ?? null,
      });
    } catch {
      setSuggestions({ breakfast: null, lunch: null, dinner: null });
    }
  }, []);

  useEffect(() => {
    loadMeals();
    loadSuggestions();
  }, [loadMeals, loadSuggestions]);

  useRealtimeEvent("meals_updated", loadMeals);

  function getSuggestionForSlot(slot: MealSlot): MealSuggestionResult | null {
    return suggestions[slot];
  }

  async function acceptSuggestion(slot: MealSlot, suggestion: MealSuggestionResult) {
    if (accepting) return;
    setAccepting(true);
    try {
      await getApiBase("/api/meals", {
        method: "POST",
        body: withActorBody({ type: slot, dish: suggestion.meal, portions: 2 }),
      });
      await loadMeals();
    } catch {
      // ignore
    } finally {
      setAccepting(false);
    }
  }

  async function chooseDish(slot: MealSlot, dish: string) {
    setAccepting(true);
    try {
      await getApiBase("/api/meals", {
        method: "POST",
        body: withActorBody({ type: slot, dish, portions: 2 }),
      });
      setShowPicker(null);
      setPickerSearch("");
      setExpanded(null);
      await loadMeals();
    } catch { /* ignore */ }
    finally { setAccepting(false); }
  }

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.25s" }}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white/90">Meals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SECTIONS.map(({ key, label }) => {
            const meal = meals[key];
            const suggestion = !meal ? getSuggestionForSlot(key) : null;
            const isExpanded = expanded === key;
            const hasMeal = meal && meal.dish;

            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="w-full text-left relative rounded-3xl border border-white/[0.06] p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]"
                  style={{
                    background: suggestion
                      ? "linear-gradient(180deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                    boxShadow: suggestion
                      ? "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(139,92,246,0.15)"
                      : "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  {suggestion && (
                    <div className="absolute top-3 right-4 flex items-center gap-1">
                      <span className="ai-sparkle text-[0.625rem] text-violet-300/80">&#10024;</span>
                      <span className="text-[0.625rem] font-medium text-violet-300/70 uppercase tracking-wider">
                        Suggested
                      </span>
                      <span className="ai-sparkle text-[0.625rem] text-violet-300/80" style={{ animationDelay: "0.3s" }}>&#10024;</span>
                    </div>
                  )}
                  <p className="text-sm text-white/60 uppercase tracking-wider mb-3">
                    {label}
                  </p>
                  {hasMeal ? (
                    <div className="text-[0.8125rem] text-white/80 space-y-0.5">
                      <p className="font-medium text-white/95">{meal.dish}</p>
                      {meal.drink && <p className="text-white/60">Drink: {meal.drink}</p>}
                    </div>
                  ) : suggestion ? (
                    <div className="text-[0.8125rem] text-white/80 space-y-0.5">
                      <p className="font-medium text-violet-200/90">{suggestion.meal}</p>
                      <p className="text-[0.75rem] text-white/45">{suggestion.reason}</p>
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-white/30 italic">Waiting for suggestions…</p>
                  )}
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div
                    className="mt-2 rounded-2xl border border-white/[0.06] p-4 backdrop-blur-xl space-y-3"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                    }}
                  >
                    {showPicker === key ? (
                      /* ─── Meal picker ─── */
                      <div className="space-y-2">
                        <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Search menu…" autoFocus
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.8125rem] text-white/90 placeholder:text-white/25 outline-none" />
                        <div className="max-h-36 overflow-y-auto space-y-1 no-scrollbar">
                          {MENU_BY_SLOT[key]
                            .filter((d) => !pickerSearch || d.toLowerCase().includes(pickerSearch.toLowerCase()))
                            .map((dish) => (
                              <button key={dish} type="button" onClick={() => chooseDish(key, dish)} disabled={accepting}
                                className="w-full text-left rounded-lg px-3 py-1.5 text-[0.8125rem] text-white/80 hover:bg-white/10 transition truncate">
                                {dish}
                              </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => { setShowPicker(null); setPickerSearch(""); }}
                          className="text-[0.75rem] text-white/40 hover:text-white/60">Cancel</button>
                      </div>
                    ) : hasMeal ? (
                      <>
                        <p className="text-[0.9375rem] font-medium text-white/95">{meal.dish}</p>
                        {meal.drink && (
                          <p className="text-[0.8125rem] text-white/60">Drink: {meal.drink}</p>
                        )}
                        <p className="text-[0.8125rem] text-white/50">
                          {meal.requested_by
                            ? `Chosen by ${meal.requested_by}`
                            : "Set by family"}{" "}
                          · {meal.portions} pax
                        </p>
                        {!readOnly && (
                          <button type="button" onClick={() => setShowPicker(key)}
                            className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[0.75rem] text-white/60 transition">
                            Change
                          </button>
                        )}
                      </>
                    ) : suggestion ? (
                      <>
                        <p className="text-[0.9375rem] font-medium text-violet-200/90">
                          {suggestion.meal}
                        </p>
                        <p className="text-[0.8125rem] text-white/50">{suggestion.reason}</p>
                        {suggestion.missingIngredients.length > 0 && (
                          <p className="text-[0.75rem] text-white/40">
                            Missing: {suggestion.missingIngredients.join(", ")}
                          </p>
                        )}
                        {!readOnly && (
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); acceptSuggestion(key, suggestion); }}
                              disabled={accepting}
                              className="rounded-xl bg-violet-600/60 hover:bg-violet-500/60 disabled:opacity-50 px-4 py-2 text-[0.8125rem] font-medium text-white transition">
                              {accepting ? "…" : "Accept"}
                            </button>
                            <button type="button" onClick={() => setShowPicker(key)}
                              className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-[0.8125rem] text-white/60 transition">
                              Choose other
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[0.8125rem] text-white/30 italic">
                        Waiting for suggestions…
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
