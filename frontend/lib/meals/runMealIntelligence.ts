/**
 * Meal intelligence: rule-based suggestions from inventory, constrained to the family's menu.
 * Prioritizes meals that use expiring ingredients. Only suggests dishes from data/menu.ts.
 */

import * as inventoryService from "../services/inventory";
import {
  getMealsFromInventory,
  getMealsUsingExpiringItems,
  type MealSuggestion as RuleSuggestion,
  type InventoryItemForMeals,
} from "./mealSuggestions";
import { BREAKFAST_ITEMS, LUNCH_ITEMS, DINNER_ITEMS } from "../../data/menu";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type MealSuggestionResult = {
  meal: string;
  reason: string;
  missingIngredients: string[];
  slot: MealSlot;
};

/** The allowed dishes per slot — only these can be suggested */
const MENU_BY_SLOT: Record<MealSlot, readonly string[]> = {
  breakfast: BREAKFAST_ITEMS,
  lunch: LUNCH_ITEMS,
  dinner: DINNER_ITEMS,
};

function normalizeMealName(s: string): string {
  return s.trim().toLowerCase();
}

function isInMenu(meal: string, slot: MealSlot): boolean {
  const norm = normalizeMealName(meal);
  return MENU_BY_SLOT[slot].some((m) => normalizeMealName(m) === norm);
}

function ruleToResult(r: RuleSuggestion, slot: MealSlot): MealSuggestionResult {
  const reason = r.usesExpiring
    ? "Uses items expiring soon"
    : r.matchScore >= 1
      ? "All ingredients in stock"
      : "Matches your inventory";
  return { meal: r.meal, reason, missingIngredients: r.missingIngredients, slot };
}

/**
 * Get meal suggestions for a specific slot (breakfast/lunch/dinner).
 * Only returns meals from the family's menu that match current inventory.
 * Expiring ingredients are prioritized.
 */
export async function runMealIntelligenceForSlot(slot: MealSlot): Promise<MealSuggestionResult[]> {
  let inventoryRows: { name: string; expiry_date?: string | null }[];
  try {
    inventoryRows = await inventoryService.fetchInventoryFromApi();
  } catch {
    return [];
  }

  const inventory: InventoryItemForMeals[] = inventoryRows.map((r) => ({
    name: r.name,
    expiry_date: r.expiry_date ?? null,
  }));

  // Get all rule-based matches, then filter to this slot's menu
  const fromExpiring = getMealsUsingExpiringItems(inventory).filter((r) => isInMenu(r.meal, slot));
  const fromInventory = getMealsFromInventory(inventory).filter((r) => isInMenu(r.meal, slot));

  const seen = new Set<string>();
  const results: MealSuggestionResult[] = [];

  // Expiring-ingredient meals first
  for (const r of fromExpiring) {
    const key = normalizeMealName(r.meal);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(ruleToResult(r, slot));
  }

  // Then inventory-match meals
  for (const r of fromInventory) {
    const key = normalizeMealName(r.meal);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(ruleToResult(r, slot));
  }

  return results.slice(0, 3);
}

/**
 * Legacy: get top 5 suggestions across all slots (for backward compat).
 */
export async function runMealIntelligence(): Promise<MealSuggestionResult[]> {
  const [b, l, d] = await Promise.all([
    runMealIntelligenceForSlot("breakfast"),
    runMealIntelligenceForSlot("lunch"),
    runMealIntelligenceForSlot("dinner"),
  ]);
  return [...b.slice(0, 1), ...l.slice(0, 3), ...d.slice(0, 1)];
}
