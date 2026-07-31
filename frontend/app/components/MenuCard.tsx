"use client";

import { Coffee, CookingPot, ForkKnife } from "@phosphor-icons/react";
import { Card, CardLabel } from "@/app/components/ui";

/* ── Today's menu, shared by Abdullah's panel and the family panel. Extracted
   verbatim from the Phase 1 staff panel so the two stay pixel-identical. ──── */

export type MealType = "breakfast" | "lunch" | "dinner";

export type Meal = { id: number; date: string; meal_type: MealType; name: string };

export type Menu = Record<MealType, string | null>;

export const EMPTY_MENU: Menu = { breakfast: null, lunch: null, dinner: null };

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

/* Icon carries the meaning, the word confirms it — Abdullah is not a native
   English speaker, so neither is left to do the job alone. Exported so the
   dashboard speaks the same icon language. */
export const MEAL_ICON: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: ForkKnife,
  dinner: CookingPot,
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function menuFromMeals(meals: Meal[]): Menu {
  const next: Menu = { ...EMPTY_MENU };
  for (const m of meals) {
    if (m.meal_type in next) next[m.meal_type] = m.name;
  }
  return next;
}

export function hasAnyMeal(menu: Menu): boolean {
  return MEAL_ORDER.some((slot) => menu[slot]);
}

export function MenuCard({ menu, className = "" }: { menu: Menu; className?: string }) {
  return (
    <Card className={className}>
      <CardLabel>Food today</CardLabel>
      <ul className="mt-h4 flex flex-col gap-h4">
        {MEAL_ORDER.map((slot) => {
          const name = menu[slot];
          if (!name) return null;
          const Icon = MEAL_ICON[slot];
          return (
            <li key={slot} className="flex items-start gap-h4">
              <Icon
                size={24}
                aria-hidden
                className="mt-[2px] shrink-0 text-hearth-ink-3"
              />
              <div className="min-w-0">
                <p className="text-h9 text-hearth-ink-3">{MEAL_LABEL[slot]}</p>
                <p className="text-h5 font-medium text-hearth-ink">{name}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
