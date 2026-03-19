/**
 * Grocery suggestion engine entry point: low-stock, expiring-soon replacement, and meal-based
 * suggestions (see grocerySuggestions.ts). Merges and upserts into groceries table; creates
 * expiration notifications. Idempotent; safe to call on load (e.g. from GroceriesCard).
 */

import * as inventoryService from "../services/inventory";
import * as groceriesService from "../services/groceries";
import * as mealsService from "../services/meals";
import * as notificationsService from "../services/notifications";
import {
  getLowInventorySuggestions,
  getExpiringReplacementSuggestions,
  getMealBasedSuggestions,
  mergeGrocerySuggestions,
  upsertSuggestedGroceries,
  type InventoryItemForSuggestions,
} from "./grocerySuggestions";
import { createExpirationNotificationsIfNeeded } from "./expirationNotifications";

function rowToSuggestionItem(row: inventoryService.InventoryRow): InventoryItemForSuggestions {
  return {
    id: row.id,
    item: row.name,
    category: row.category,
    quantity: row.quantity,
    threshold: row.threshold,
    expiration_date: row.expiry_date ?? null,
  };
}

/**
 * Runs suggestion engine and expiration notifications once. Safe to call on load.
 */
export async function runGroceryIntelligence(): Promise<void> {
  const [inventoryRows, mealsRows] = await Promise.all([
    inventoryService.fetchInventory(),
    mealsService.fetchMeals(new Date().toISOString().slice(0, 10)),
  ]);
  const inventory = inventoryRows.map(rowToSuggestionItem);

  const low = getLowInventorySuggestions(inventory);
  const expiring = getExpiringReplacementSuggestions(inventory);
  const mealDishes = mealsRows.map((m) => ({
    slot: m.slot,
    dish: m.dish,
    people_count: m.people_count ?? 1,
  }));
  const mealBased = getMealBasedSuggestions(inventory, mealDishes);
  const merged = mergeGrocerySuggestions(low, expiring, mealBased);

  await upsertSuggestedGroceries(merged, async () => {
    const g = await groceriesService.fetchGroceries();
    return g.map((x) => ({ title: x.title, reason: x.reason }));
  });

  await createExpirationNotificationsIfNeeded(
    async () => {
      const rows = await inventoryService.fetchFoodInventory();
      return rows.map((r) => ({
        id: r.id,
        item: r.name,
        expiration_date: r.expiry_date ?? null,
      }));
    },
    async () => {
      const rows = await notificationsService.fetchNotifications();
      return rows.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
      }));
    }
  );
}
