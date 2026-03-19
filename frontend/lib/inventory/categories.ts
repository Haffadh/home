export const INVENTORY_CATEGORIES = ["Food", "Cleaning", "Household", "Other"] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const LARGE_SHOPPING_THRESHOLD = 20;
export const LARGE_SHOPPING_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
export const INVENTORY_AUDIT_DAYS_AFTER_LARGE_SHOPPING = 7;
export const INVENTORY_AUDIT_TASK_DURATION_MINUTES = 60;
