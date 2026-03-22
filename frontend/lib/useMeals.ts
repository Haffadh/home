"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeTable } from "./useRealtimeTable";
import { getSupabaseClient } from "./supabaseClient";
import * as mealsService from "./services/meals";
import type { MealRow, MealSlot } from "./services/meals";
import type { MealEntry } from "@/types/houseBrain";

export type MealsState = {
  breakfast: MealEntry | null;
  lunch: MealEntry | null;
  dinner: MealEntry | null;
};

const DEFAULT_MEALS: MealsState = {
  breakfast: null,
  lunch: null,
  dinner: null,
};

function rowToEntry(row: MealRow): MealEntry {
  return {
    dish: row.dish ?? "",
    drink: row.drink ?? "",
    requestedBy: (row.requested_by as MealEntry["requestedBy"]) ?? "Baba",
    peopleCount: row.people_count ?? 1,
    options: row.options ?? undefined,
  };
}

function rowsToState(rows: MealRow[], date: string): MealsState {
  const bySlot: MealsState = { ...DEFAULT_MEALS };
  for (const row of rows) {
    if (row.meal_date !== date && row.meal_date != null) continue;
    const slot = row.slot as keyof MealsState;
    if (!bySlot[slot]) bySlot[slot] = rowToEntry(row);
  }
  return bySlot;
}

/** Single source of truth: Supabase meals table. Realtime subscription included. */
export function useMeals(): {
  meals: MealsState;
  setMealSlot: (slot: "breakfast" | "lunch" | "dinner", entry: MealEntry | null) => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const [meals, setMeals] = useState<MealsState>(DEFAULT_MEALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowsBySlotId, setRowsBySlotId] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let rows: import("./services/meals").MealRow[];
      try {
        rows = await mealsService.fetchMealsFromApi();
      } catch {
        rows = getSupabaseClient() ? await mealsService.fetchMeals(today) : [];
      }
      setMeals(rowsToState(rows, today));
      const ids: Record<string, string> = {};
      for (const r of rows) {
        if (r.meal_date !== today && r.meal_date != null) continue;
        if (!(r.slot in ids)) ids[r.slot] = r.id;
      }
      setRowsBySlotId(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meals");
      setMeals(DEFAULT_MEALS);
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeTable("meals", load);

  // Also listen for WebSocket meals_updated events (works without Supabase)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event === "meals_updated") load();
    };
    window.addEventListener("realtime", handler);
    return () => window.removeEventListener("realtime", handler);
  }, [load]);

  const setMealSlot = useCallback(async (slot: MealSlot, entry: MealEntry | null) => {
    try {
      if (entry === null) {
        // Delete meal - try backend, fall back to Supabase
        const id = rowsBySlotId[slot];
        if (id && getSupabaseClient()) await mealsService.deleteMeal(id);
      } else {
        // Create/update via backend API so WebSocket broadcasts
        const { getApiBase, withActorBody } = await import("./api");
        await getApiBase("/api/meals", {
          method: "POST",
          body: withActorBody({
            type: slot,
            dish: entry.dish || null,
            drink: entry.drink || null,
            portions: entry.peopleCount ?? 1,
            requested_by: entry.requestedBy || null,
          }),
        });
      }
      await load();
    } catch {
      await load();
    }
  }, [rowsBySlotId, load]);

  return { meals, setMealSlot, loading, error };
}
