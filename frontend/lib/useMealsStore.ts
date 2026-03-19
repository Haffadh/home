"use client";

import { useCallback, useEffect, useState } from "react";
import { getMeals, setMeals, type MealsSelection } from "./menu";

/** Hook to read and update shared meals (breakfast/lunch/dinner). Kitchen and Abdullah read; House updates. */
export function useMealsStore(): { meals: MealsSelection; setMeals: (meals: Partial<MealsSelection> | MealsSelection) => void } {
  const [meals, setMealsState] = useState<MealsSelection>(() => getMeals());

  useEffect(() => {
    const onUpdate = () => setMealsState(getMeals());
    window.addEventListener("meals-updated", onUpdate);
    return () => window.removeEventListener("meals-updated", onUpdate);
  }, []);

  const updateMeals = useCallback((next: Partial<MealsSelection> | MealsSelection) => {
    setMeals(next);
    setMealsState(getMeals());
  }, []);

  return { meals, setMeals: updateMeals };
}
