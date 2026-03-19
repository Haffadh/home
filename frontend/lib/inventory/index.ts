export {
  INVENTORY_CATEGORIES,
  LARGE_SHOPPING_THRESHOLD,
  LARGE_SHOPPING_WINDOW_MS,
  INVENTORY_AUDIT_DAYS_AFTER_LARGE_SHOPPING,
  INVENTORY_AUDIT_TASK_DURATION_MINUTES,
} from "./categories";
export type { InventoryCategory } from "./categories";

export {
  isLargeShopping,
  detectLargeShoppingEvent,
  getNextAuditDate,
  getInventoryAuditDateAfterLargeShopping,
  getInventoryAuditTaskDurationMinutes,
  shouldCreateInventoryAuditTask,
} from "./largeShopping";

export { ensureInventoryAuditTaskIfNeeded } from "./auditTask";

export {
  getItemsExpiringInDays,
  getItemsExpiringToday,
} from "./expiration";
export type { ItemWithExpiration } from "./expiration";

export {
  getLowInventorySuggestions,
  getExpiringReplacementSuggestions,
  getMealBasedSuggestions,
  mergeGrocerySuggestions,
  upsertSuggestedGroceries,
} from "./grocerySuggestions";
export type { GrocerySuggestion, InventoryItemForSuggestions, MealDish } from "./grocerySuggestions";

export {
  createExpirationNotificationsIfNeeded,
  hasExistingExpirationNotification,
} from "./expirationNotifications";

export { ensureInventoryAuditDueNotificationIfNeeded } from "./auditNotification";

export { runGroceryIntelligence } from "./runGroceryIntelligence";
