/**
 * Grocery suggestion engine: low inventory, expiring-soon replacement, meal-based.
 * Deterministic heuristics only; no OpenAI in this pass.
 */

export type GrocerySuggestion = {
  item: string;
  category: string;
  suggested_quantity: number;
  reason: string;
  linked_meal?: string | null;
};

/** Shape used for suggestion input: item name, category, quantity, threshold, optional expiration (for food). */
export type InventoryItemForSuggestions = {
  id: string;
  item: string;
  category: string;
  quantity: number;
  threshold: number;
  expiration_date?: string | null;
};

/** Meal slot + dish for meal-based suggestions. */
export type MealDish = {
  slot: string;
  dish: string | null;
  people_count: number;
};

const EXPIRING_SOON_DAYS = 3;
const DEFAULT_SUGGESTED_QTY = 1;

/**
 * Items whose quantity is below threshold → suggest to restock.
 */
export function getLowInventorySuggestions(
  inventory: InventoryItemForSuggestions[]
): GrocerySuggestion[] {
  return inventory
    .filter((i) => i.quantity < i.threshold)
    .map((i) => ({
      item: i.item,
      category: i.category,
      suggested_quantity: Math.max(DEFAULT_SUGGESTED_QTY, i.threshold - i.quantity),
      reason: "Low inventory",
      linked_meal: null,
    }));
}

/**
 * Food items expiring within EXPIRING_SOON_DAYS → suggest replacement (one per item).
 */
export function getExpiringReplacementSuggestions(
  inventory: InventoryItemForSuggestions[],
  withinDays: number = EXPIRING_SOON_DAYS
): GrocerySuggestion[] {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return inventory
    .filter((i) => i.category === "Food" && i.expiration_date) 
    .filter((i) => {
      const d = (i.expiration_date ?? "").slice(0, 10);
      return d >= today && d <= cutoffStr;
    })
    .map((i) => ({
      item: i.item,
      category: i.category,
      suggested_quantity: Math.max(DEFAULT_SUGGESTED_QTY, i.threshold),
      reason: "Expiring soon – replace",
      linked_meal: null,
    }));
}

/**
 * Meals reference dishes; if an inventory item matches a dish and stock is low/missing, suggest it.
 * Simple match: dish name equals item name (case-insensitive).
 */
export function getMealBasedSuggestions(
  inventory: InventoryItemForSuggestions[],
  meals: MealDish[]
): GrocerySuggestion[] {
  const dishes = meals
    .map((m) => m.dish)
    .filter((d): d is string => d != null && d.trim() !== "");
  const suggested: GrocerySuggestion[] = [];
  const seen = new Set<string>();
  for (const dish of dishes) {
    const normalizedDish = dish.trim().toLowerCase();
    if (seen.has(normalizedDish)) continue;
    const match = inventory.find((i) => i.item.trim().toLowerCase() === normalizedDish);
    if (!match) continue;
    seen.add(normalizedDish);
    if (match.quantity >= match.threshold) continue;
    suggested.push({
      item: match.item,
      category: match.category,
      suggested_quantity: Math.max(DEFAULT_SUGGESTED_QTY, match.threshold - match.quantity),
      reason: "Meal ingredient low",
      linked_meal: dish,
    });
  }
  return suggested;
}

/**
 * Merges suggestion lists and deduplicates by item (first reason wins).
 */
export function mergeGrocerySuggestions(
  ...lists: GrocerySuggestion[][]
): GrocerySuggestion[] {
  const byItem = new Map<string, GrocerySuggestion>();
  for (const list of lists) {
    for (const s of list) {
      const key = s.item.trim().toLowerCase();
      if (!byItem.has(key)) byItem.set(key, s);
    }
  }
  return Array.from(byItem.values());
}

/** Normalize for duplicate check: title + reason. */
function groceryKey(title: string, reason: string | null): string {
  return `${title.trim().toLowerCase()}:${(reason ?? "").trim().toLowerCase()}`;
}

/**
 * Idempotent upsert: add suggestion as grocery only if no existing row has same title+reason.
 * Uses requested_by "inventory" for suggested items.
 */
export async function upsertSuggestedGroceries(
  suggestions: GrocerySuggestion[],
  getExistingGroceries: () => Promise<{ title: string; reason: string | null }[]>
): Promise<void> {
  const existing = await getExistingGroceries();
  const existingKeys = new Set(existing.map((g) => groceryKey(g.title, g.reason)));
  const { addGrocery } = await import("../services/groceries");
  for (const s of suggestions) {
    const key = groceryKey(s.item, s.reason);
    if (existingKeys.has(key)) continue;
    try {
      await addGrocery({
        title: s.item,
        requested_by: "inventory",
        category: s.category,
        suggested_quantity: s.suggested_quantity,
        reason: s.reason,
        linked_meal: s.linked_meal ?? null,
      });
      existingKeys.add(key);
    } catch {
      // skip on conflict or error
    }
  }
}
