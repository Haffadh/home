/**
 * Detects if a set of grocery additions (by created_at) counts as "Large Shopping"
 * (e.g. more than 20 items within a short time window).
 * Used to trigger creation of an "Inventory Audit" task 7 days later (Abdullah only).
 */

import {
  LARGE_SHOPPING_THRESHOLD,
  LARGE_SHOPPING_WINDOW_MS,
  INVENTORY_AUDIT_DAYS_AFTER_LARGE_SHOPPING,
  INVENTORY_AUDIT_TASK_DURATION_MINUTES,
} from "./categories";

export function isLargeShopping(
  createdAtTimestamps: string[],
  threshold: number = LARGE_SHOPPING_THRESHOLD,
  windowMs: number = LARGE_SHOPPING_WINDOW_MS
): boolean {
  if (createdAtTimestamps.length < threshold) return false;
  const sorted = [...createdAtTimestamps].map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - threshold; i++) {
    const windowStart = sorted[i];
    const windowEnd = windowStart + windowMs;
    const count = sorted.filter((t) => t >= windowStart && t <= windowEnd).length;
    if (count >= threshold) return true;
  }
  return false;
}

/**
 * Detects a "Large Shopping" event from grocery rows (by created_at).
 * Returns the start-of-window date (YYYY-MM-DD) of the first such event found, or null.
 */
export function detectLargeShoppingEvent(
  groceryRows: { created_at: string }[],
  threshold: number = LARGE_SHOPPING_THRESHOLD,
  windowMs: number = LARGE_SHOPPING_WINDOW_MS
): string | null {
  const timestamps = groceryRows.map((r) => r.created_at);
  if (timestamps.length < threshold) return null;
  const sorted = [...timestamps].map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - threshold; i++) {
    const windowStart = sorted[i];
    const windowEnd = windowStart + windowMs;
    const count = sorted.filter((t) => t >= windowStart && t <= windowEnd).length;
    if (count >= threshold) return new Date(windowStart).toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Returns the audit date (YYYY-MM-DD) 7 days after a large shopping event date.
 */
export function getNextAuditDate(largeShoppingDate: string): string {
  const d = new Date(largeShoppingDate + "T12:00:00");
  d.setDate(d.getDate() + INVENTORY_AUDIT_DAYS_AFTER_LARGE_SHOPPING);
  return d.toISOString().slice(0, 10);
}

/** Alias for getNextAuditDate (kept for compatibility). */
export function getInventoryAuditDateAfterLargeShopping(largeShoppingDate: string): string {
  return getNextAuditDate(largeShoppingDate);
}

export function getInventoryAuditTaskDurationMinutes(): number {
  return INVENTORY_AUDIT_TASK_DURATION_MINUTES;
}

/**
 * Whether we should create an Inventory Audit task for the given audit date.
 * Prevents duplicates: only create if there is no existing audit task for that date.
 */
export function shouldCreateInventoryAuditTask(
  auditDate: string,
  hasExistingAuditTaskForDate: boolean
): boolean {
  return !hasExistingAuditTaskForDate;
}
