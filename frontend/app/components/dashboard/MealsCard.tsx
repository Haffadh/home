"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [modalSlot, setModalSlot] = useState<MealSlot | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  // Long press
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  function handlePressStart(slot: MealSlot) {
    setIsLongPress(false);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      setModalSlot(slot);
      setShowPicker(false);
      setPickerSearch("");
      pressTimerRef.current = null;
    }, 500);
  }
  function handlePressEnd() {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  }
  useEffect(() => { return () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }; }, []);

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
      setShowPicker(false);
      setPickerSearch("");
      setModalSlot(null);
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
            const hasMeal = meal && meal.dish;

            return (
              <div key={key}>
                <button
                  type="button"
                  onMouseDown={() => handlePressStart(key)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handlePressStart(key)}
                  onTouchEnd={handlePressEnd}
                  onContextMenu={(e) => e.preventDefault()}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Long-press meal detail modal */}
      {modalSlot && (() => {
        const meal = meals[modalSlot];
        const suggestion = !meal ? getSuggestionForSlot(modalSlot) : null;
        const hasMeal = meal && meal.dish;
        const label = SECTIONS.find((s) => s.key === modalSlot)?.label ?? modalSlot;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setModalSlot(null); setShowPicker(false); setPickerSearch(""); }} />
            <div className="relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-[28px] p-6 animate-modal-in"
              style={{ background: "rgba(18,24,38,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
              onClick={(e) => e.stopPropagation()}>

              <p className="text-[0.625rem] text-white/40 uppercase tracking-wider mb-1">{label}</p>

              {showPicker ? (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-white/95">Choose a dish</h3>
                  <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search menu…" autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[0.875rem] text-white/90 placeholder:text-white/25 outline-none" />
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {MENU_BY_SLOT[modalSlot]
                      .filter((d) => !pickerSearch || d.toLowerCase().includes(pickerSearch.toLowerCase()))
                      .map((dish) => (
                        <button key={dish} type="button" onClick={() => chooseDish(modalSlot, dish)} disabled={accepting}
                          className="w-full text-left rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/80 hover:bg-white/10 transition truncate">
                          {dish}
                        </button>
                      ))}
                  </div>
                  <button type="button" onClick={() => { setShowPicker(false); setPickerSearch(""); }}
                    className="shrink-0 w-full rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                    Back
                  </button>
                </div>
              ) : hasMeal ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white/95">{meal.dish}</h3>
                  {meal.drink && <p className="text-[0.875rem] text-white/60">Drink: {meal.drink}</p>}
                  <p className="text-[0.875rem] text-white/50">
                    {meal.requested_by ? `Chosen by ${meal.requested_by}` : "Set by family"} · {meal.portions} pax
                  </p>
                  <div className="flex gap-2 pt-2">
                    {!readOnly && (
                      <button type="button" onClick={() => setShowPicker(true)}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1e293b]/60 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#1e293b]/80 transition">
                        Change
                      </button>
                    )}
                    <button type="button" onClick={() => setModalSlot(null)}
                      className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                      Close
                    </button>
                  </div>
                </div>
              ) : suggestion ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="ai-sparkle text-violet-300/80">&#10024;</span>
                    <h3 className="text-xl font-semibold text-violet-200/90">{suggestion.meal}</h3>
                  </div>
                  <p className="text-[0.875rem] text-white/50">{suggestion.reason}</p>
                  {suggestion.missingIngredients.length > 0 && (
                    <p className="text-[0.8125rem] text-white/40">Missing: {suggestion.missingIngredients.join(", ")}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    {!readOnly && (
                      <>
                        <button type="button"
                          onClick={() => { acceptSuggestion(modalSlot, suggestion); setModalSlot(null); }}
                          disabled={accepting}
                          className="flex-1 rounded-2xl bg-violet-600/60 hover:bg-violet-500/60 disabled:opacity-50 py-2.5 text-[0.8125rem] font-medium text-white transition">
                          {accepting ? "…" : "Accept"}
                        </button>
                        <button type="button" onClick={() => setShowPicker(true)}
                          className="flex-1 rounded-2xl border border-white/10 bg-[#1e293b]/60 py-2.5 text-[0.8125rem] text-white/80 transition">
                          Choose other
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setModalSlot(null)}
                      className={`${readOnly ? "flex-1" : ""} rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 px-4 text-[0.8125rem] text-white/60 transition`}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[0.875rem] text-white/40">No meal set and no suggestions available.</p>
                  {!readOnly && (
                    <button type="button" onClick={() => setShowPicker(true)}
                      className="w-full rounded-2xl border border-white/10 bg-[#1e293b]/60 py-2.5 text-[0.8125rem] text-white/80 transition">
                      Choose a dish
                    </button>
                  )}
                  <button type="button" onClick={() => setModalSlot(null)}
                    className="w-full rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </GlassCard>
  );
}
