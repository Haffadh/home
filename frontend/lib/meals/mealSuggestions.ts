/**
 * Rule-based meal suggestion engine. Uses inventory and expiration data.
 * Does not modify inventory or grocery logic.
 */

import { MEAL_INGREDIENTS, getMealsWithIngredients } from "./mealIngredients";

const EXPIRING_DAYS = 3;

export type InventoryItemForMeals = {
  name: string;
  expiry_date?: string | null;
};

export type MealSuggestion = {
  meal: string;
  matchScore: number;
  usesExpiring: boolean;
  missingIngredients: string[];
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function inventorySet(inventory: InventoryItemForMeals[]): Set<string> {
  const set = new Set<string>();
  for (const i of inventory) {
    if (i.name?.trim()) set.add(normalize(i.name));
  }
  return set;
}

/** Items expiring within EXPIRING_DAYS (by date string YYYY-MM-DD). */
function expiringSoonSet(inventory: InventoryItemForMeals[]): Set<string> {
  const set = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + EXPIRING_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  for (const i of inventory) {
    const d = i.expiry_date?.slice(0, 10);
    if (d && d >= today && d <= cutoffStr && i.name?.trim()) set.add(normalize(i.name));
  }
  return set;
}

/**
 * Returns meals where most ingredients already exist in inventory.
 * matchScore = (ingredients in stock) / (total ingredients), 0..1.
 */
export function getMealsFromInventory(inventory: InventoryItemForMeals[]): MealSuggestion[] {
  const inStock = inventorySet(inventory);
  const expiring = expiringSoonSet(inventory);
  const meals = getMealsWithIngredients();
  const results: MealSuggestion[] = [];

  for (const meal of meals) {
    const required = MEAL_INGREDIENTS[meal];
    if (!required?.length) continue;
    const requiredNorm = required.map(normalize);
    const inStockCount = requiredNorm.filter((ing) => inStock.has(ing)).length;
    const matchScore = inStockCount / requiredNorm.length;
    if (matchScore < 0.3) continue;
    const missing = required.filter((ing) => !inStock.has(normalize(ing)));
    const usesExpiring = requiredNorm.some((ing) => expiring.has(ing));
    results.push({ meal, matchScore, usesExpiring, missingIngredients: missing });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

/**
 * Prioritize meals that use items expiring within EXPIRING_DAYS.
 */
export function getMealsUsingExpiringItems(inventory: InventoryItemForMeals[]): MealSuggestion[] {
  const expiring = expiringSoonSet(inventory);
  if (expiring.size === 0) return [];
  const inStock = inventorySet(inventory);
  const meals = getMealsWithIngredients();
  const results: MealSuggestion[] = [];

  for (const meal of meals) {
    const required = MEAL_INGREDIENTS[meal];
    if (!required?.length) continue;
    const requiredNorm = required.map(normalize);
    const usesExpiring = requiredNorm.some((ing) => expiring.has(ing));
    if (!usesExpiring) continue;
    const inStockCount = requiredNorm.filter((ing) => inStock.has(ing)).length;
    const matchScore = inStockCount / requiredNorm.length;
    const missing = required.filter((ing) => !inStock.has(normalize(ing)));
    results.push({ meal, matchScore, usesExpiring: true, missingIngredients: missing });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

/**
 * Return ingredients required for a meal but not in inventory.
 */
export function getMissingIngredientsForMeal(
  meal: string,
  inventory: InventoryItemForMeals[]
): string[] {
  const required = MEAL_INGREDIENTS[meal];
  if (!required?.length) return [];
  const inStock = inventorySet(inventory);
  return required.filter((ing) => !inStock.has(normalize(ing)));
}
