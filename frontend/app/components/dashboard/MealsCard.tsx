"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GlassCard from "./GlassCard";
import { getApiBase, withActorBody } from "../../../lib/api";
import { useRealtimeEvent } from "../../context/RealtimeContext";
import { runMealIntelligenceForSlot } from "../../../lib/meals/runMealIntelligence";
import type { MealSuggestionResult } from "../../../lib/meals/runMealIntelligence";
import { BREAKFAST_ITEMS, LUNCH_ITEMS, DINNER_ITEMS, DISH_SUB_OPTIONS, SOUP_ITEMS, LUNCH_ITEMS_BY_PROTEIN } from "../../../data/menu";
import { MEAL_INGREDIENTS } from "../../../lib/meals/mealIngredients";

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
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [customPhoto, setCustomPhoto] = useState<Record<string, string>>({}); // dish→base64
  const [imageClickCount, setImageClickCount] = useState(0);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [subOptions, setSubOptions] = useState<{ dish: string; step: number; choices: string[] } | null>(null);
  const [portionSize, setPortionSize] = useState(6);
  const [inventoryNames, setInventoryNames] = useState<Set<string>>(new Set());

  // Load inventory names for availability check
  useEffect(() => {
    getApiBase("/api/inventory").then((data) => {
      const items = (data as { items?: { name: string }[] })?.items ?? [];
      setInventoryNames(new Set(items.map((i) => i.name.toLowerCase())));
    }).catch(() => {});
  }, []);
  const photoRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function openMealModal(slot: MealSlot) {
    setModalSlot(slot);
    setShowPicker(false);
    setPickerSearch("");
  }

  // Load dish image when modal opens
  useEffect(() => {
    if (!modalSlot) { setDishImage(null); return; }
    const meal = meals[modalSlot];
    const suggestion = !meal ? getSuggestionForSlot(modalSlot) : null;
    const dishName = meal?.dish || suggestion?.meal;
    if (!dishName) return;
    // Check for custom photo first
    if (customPhoto[dishName]) { setDishImage(customPhoto[dishName]); return; }
    getApiBase(`/api/meals/image?dish=${encodeURIComponent(dishName)}`).then((data) => {
      const url = (data as { url?: string })?.url;
      if (url) setDishImage(url);
    }).catch(() => {});
  }, [modalSlot, meals, customPhoto]);

  function handleImageClick(dishName: string) {
    setImageClickCount((c) => {
      const next = c + 1;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (next >= 3) {
        setShowPhotoUpload(true);
        return 0;
      }
      clickTimerRef.current = setTimeout(() => setImageClickCount(0), 600);
      return next;
    });
  }

  function handlePhotoUpload(file: File, dishName: string) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomPhoto((prev) => ({ ...prev, [dishName]: base64 }));
      setDishImage(base64);
      setShowPhotoUpload(false);
    };
    reader.readAsDataURL(file);
  }

  function getDishAvailability(dish: string): { available: boolean; missing: string[] } {
    const ingredients = MEAL_INGREDIENTS[dish];
    if (!ingredients || inventoryNames.size === 0) return { available: true, missing: [] };
    const missing = ingredients.filter((ing) => !inventoryNames.has(ing.toLowerCase()));
    return { available: missing.length === 0, missing };
  }

  function DishButton({ dish, slot }: { dish: string; slot: MealSlot }) {
    const { available, missing } = getDishAvailability(dish);
    return (
      <button type="button" onClick={() => handleDishWithSubOptions(slot, dish)} disabled={accepting}
        className="w-full text-left rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/80 hover:bg-white/10 transition flex items-center justify-between gap-2">
        <span className="truncate">{dish}</span>
        {available ? (
          <span className="shrink-0 text-[0.5625rem] text-emerald-400/60">Ready</span>
        ) : (
          <span className="shrink-0 text-[0.5625rem] text-amber-400/60" title={`Missing: ${missing.join(", ")}`}>
            {missing.length} missing
          </span>
        )}
      </button>
    );
  }

  function handleDishWithSubOptions(slot: MealSlot, dish: string) {
    const subs = DISH_SUB_OPTIONS[dish];
    if (subs && subs.length > 0) {
      setSubOptions({ dish, step: 0, choices: [] });
    } else {
      chooseDish(slot, dish);
    }
  }

  function handleSubOptionChoice(choice: string) {
    if (!subOptions || !modalSlot) return;
    const newChoices = [...subOptions.choices, choice];
    const subs = DISH_SUB_OPTIONS[subOptions.dish];
    if (newChoices.length < subs.length) {
      setSubOptions({ ...subOptions, step: subOptions.step + 1, choices: newChoices });
    } else {
      // Separate card-visible choices (sides) from detail-only choices (cooking style)
      const cardParts: string[] = [];
      const detailParts: string[] = [];
      subs.forEach((s, i) => {
        if (s.showOnCard) cardParts.push(newChoices[i]);
        else detailParts.push(newChoices[i]);
      });
      // Dish name: "Salmon · Rice" or "Eggs (Scrambled, Medium)"
      let dishName = subOptions.dish;
      if (cardParts.length > 0) dishName += ` · ${cardParts.join(", ")}`;
      if (detailParts.length > 0) dishName += ` (${detailParts.join(", ")})`;
      chooseDish(modalSlot, dishName);
      setSubOptions(null);
    }
  }

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
        body: withActorBody({ type: slot, dish: suggestion.meal, portions: portionSize }),
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
        body: withActorBody({ type: slot, dish, portions: portionSize }),
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
                  onClick={() => openMealModal(key)}
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
                      <p className="font-medium text-white/95">{(meal.dish ?? "").replace(/\s*\([^)]*\)\s*$/, "").replace("· with ", "· ")}</p>
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

      {/* Long-press meal detail modal — portal to body so overflow-hidden parents don't clip */}
      {modalSlot && typeof document !== "undefined" && createPortal((() => {
        const meal = meals[modalSlot];
        const suggestion = !meal ? getSuggestionForSlot(modalSlot) : null;
        const hasMeal = meal && meal.dish;
        const label = SECTIONS.find((s) => s.key === modalSlot)?.label ?? modalSlot;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setModalSlot(null); setShowPicker(false); setPickerSearch(""); }} />
            <div className="relative w-full max-w-sm max-h-[70vh] flex flex-col rounded-[28px] p-6 animate-modal-in overflow-y-auto"
              style={{ background: "rgba(18,24,38,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
              onClick={(e) => e.stopPropagation()}>

              <p className="text-[0.625rem] text-white/40 uppercase tracking-wider mb-1">{label}</p>

              {/* Sub-options flow (eggs, salmon, etc.) */}
              {subOptions ? (() => {
                const subs = DISH_SUB_OPTIONS[subOptions.dish];
                const currentQ = subs[subOptions.step];
                return (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white/95">{subOptions.dish}</h3>
                    <p className="text-[0.875rem] text-white/60">{currentQ.question}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {currentQ.options.map((opt) => (
                        <button key={opt} type="button" onClick={() => handleSubOptionChoice(opt)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[0.8125rem] text-white/80 hover:bg-white/10 transition">
                          {opt}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setSubOptions(null)}
                      className="text-[0.75rem] text-white/40 hover:text-white/60">Cancel</button>
                  </div>
                );
              })() : showPicker ? (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-white/95">Choose a dish</h3>
                  <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search menu…" autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[0.875rem] text-white/90 placeholder:text-white/25 outline-none" />
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {modalSlot === "lunch" && !pickerSearch ? (
                      /* Categorized lunch menu */
                      <>
                        {SOUP_ITEMS.length > 0 && (
                          <>
                            <p className="text-[0.625rem] text-white/35 uppercase tracking-wider pt-2 pb-1 px-1">Appetizers</p>
                            {([...SOUP_ITEMS] as string[]).map((dish) => (
                              <DishButton key={dish} dish={dish} slot={modalSlot} />
                            ))}
                          </>
                        )}
                        {Object.entries(LUNCH_ITEMS_BY_PROTEIN).map(([protein, dishes]) => (
                          <div key={protein}>
                            <p className="text-[0.625rem] text-white/35 uppercase tracking-wider pt-3 pb-1 px-1">{protein}</p>
                            {([...dishes] as string[]).map((dish) => (
                              <DishButton key={dish} dish={dish} slot={modalSlot} />
                            ))}
                          </div>
                        ))}
                      </>
                    ) : (
                      /* Flat list for breakfast/dinner or when searching */
                      MENU_BY_SLOT[modalSlot]
                        .filter((d) => !pickerSearch || d.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((dish) => (
                          <button key={dish} type="button" onClick={() => handleDishWithSubOptions(modalSlot, dish)} disabled={accepting}
                            className="w-full text-left rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/80 hover:bg-white/10 transition truncate">{dish}</button>
                        ))
                    )}
                  </div>
                  <button type="button" onClick={() => { setShowPicker(false); setPickerSearch(""); }}
                    className="shrink-0 w-full rounded-2xl border border-white/10 bg-[#12101e]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                    Back
                  </button>
                </div>
              ) : hasMeal ? (
                <div className="space-y-4">
                  {/* Dish image */}
                  {dishImage && (
                    <div className="relative">
                      <img src={dishImage} alt={meal.dish ?? ""} onClick={() => handleImageClick(meal.dish ?? "")}
                        className="w-full h-36 object-cover rounded-2xl cursor-pointer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {showPhotoUpload && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                          <button type="button" onClick={() => photoRef.current?.click()}
                            className="rounded-xl bg-white/20 px-4 py-2 text-[0.8125rem] text-white font-medium">
                            📸 Take photo
                          </button>
                          <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], meal.dish ?? "")} />
                        </div>
                      )}
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-white/95">{meal.dish}</h3>
                  {meal.drink && <p className="text-[0.875rem] text-white/60">Drink: {meal.drink}</p>}
                  <p className="text-[0.875rem] text-white/50">
                    {meal.requested_by ? `Chosen by ${meal.requested_by}` : "Set by family"} · {meal.portions} pax
                  </p>
                  {!readOnly && (
                    <div>
                      <label className="block text-[0.625rem] text-white/35 uppercase mb-1">Portions</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button key={n} type="button" onClick={() => setPortionSize(n)}
                            className={`w-9 h-9 rounded-xl text-[0.8125rem] font-medium transition ${portionSize === n ? "bg-white/15 text-white/90 border border-white/20" : "bg-white/5 text-white/40 border border-white/[0.06]"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {!readOnly && (
                      <button type="button" onClick={() => setShowPicker(true)}
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1730]/60 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#1a1730]/80 transition">
                        Change
                      </button>
                    )}
                    <button type="button" onClick={() => { setModalSlot(null); setShowPhotoUpload(false); }}
                      className="flex-1 rounded-2xl border border-white/10 bg-[#12101e]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                      Close
                    </button>
                  </div>
                </div>
              ) : suggestion ? (
                <div className="space-y-4">
                  {dishImage && (
                    <img src={dishImage} alt={suggestion.meal} className="w-full h-36 object-cover rounded-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="ai-sparkle text-violet-300/80">&#10024;</span>
                    <h3 className="text-xl font-semibold text-violet-200/90">{suggestion.meal}</h3>
                  </div>
                  <p className="text-[0.875rem] text-white/50">{suggestion.reason}</p>
                  {suggestion.missingIngredients.length > 0 && (
                    <p className="text-[0.8125rem] text-white/40">Missing: {suggestion.missingIngredients.join(", ")}</p>
                  )}
                  {!readOnly && (
                    <div>
                      <label className="block text-[0.625rem] text-white/35 uppercase mb-1">Portions</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button key={n} type="button" onClick={() => setPortionSize(n)}
                            className={`w-9 h-9 rounded-xl text-[0.8125rem] font-medium transition ${portionSize === n ? "bg-white/15 text-white/90 border border-white/20" : "bg-white/5 text-white/40 border border-white/[0.06]"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
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
                          className="flex-1 rounded-2xl border border-white/10 bg-[#1a1730]/60 py-2.5 text-[0.8125rem] text-white/80 transition">
                          Choose other
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setModalSlot(null)}
                      className={`${readOnly ? "flex-1" : ""} rounded-2xl border border-white/10 bg-[#12101e]/70 py-2.5 px-4 text-[0.8125rem] text-white/60 transition`}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[0.875rem] text-white/40">No meal set and no suggestions available.</p>
                  {!readOnly && (
                    <button type="button" onClick={() => setShowPicker(true)}
                      className="w-full rounded-2xl border border-white/10 bg-[#1a1730]/60 py-2.5 text-[0.8125rem] text-white/80 transition">
                      Choose a dish
                    </button>
                  )}
                  <button type="button" onClick={() => setModalSlot(null)}
                    className="w-full rounded-2xl border border-white/10 bg-[#12101e]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })(), document.body)}
    </GlassCard>
  );
}
