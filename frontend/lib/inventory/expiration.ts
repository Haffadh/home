/**
 * Expiration groundwork for inventory items. Used later for expiration reminders/notifications.
 */

export type ItemWithExpiration = {
  id: string;
  expiration_date: string | null;
  [key: string]: unknown;
};

/**
 * Returns items that have an expiration_date within the next `days` days (inclusive).
 * Items with no expiration_date are excluded.
 */
export function getItemsExpiringInDays<T extends ItemWithExpiration>(
  items: T[],
  days: number
): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  return items.filter((item) => {
    const exp = item.expiration_date;
    if (!exp) return false;
    const dateStr = exp.slice(0, 10);
    return dateStr >= todayStr && dateStr <= endStr;
  });
}

/**
 * Returns items that expire today (expiration_date is today's date).
 */
export function getItemsExpiringToday<T extends ItemWithExpiration>(items: T[]): T[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return items.filter(
    (item) => item.expiration_date != null && item.expiration_date.slice(0, 10) === todayStr
  );
}
