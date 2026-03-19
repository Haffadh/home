/**
 * Idempotent expiration reminder notifications: 3 days before and on expiration day.
 * Uses notifications table; entity_type/entity_id prevent duplicates.
 */

import * as notificationsService from "../services/notifications";

const ENTITY_TYPE_EXPIRATION = "inventory_expiration";
const REMINDER_3_DAYS = "3days";
const REMINDER_TODAY = "today";

function entityId(inventoryItemId: string, expirationDateStr: string, kind: string): string {
  return `${inventoryItemId}:${expirationDateStr}:${kind}`;
}

/**
 * Returns true if a notification already exists for this item/expiration date/reminder kind.
 */
export async function hasExistingExpirationNotification(
  inventoryItemId: string,
  expirationDateStr: string,
  kind: "3days" | "today",
  existingNotifications: { entity_type: string | null; entity_id: string | null }[]
): Promise<boolean> {
  const eid = entityId(inventoryItemId, expirationDateStr, kind);
  return existingNotifications.some(
    (n) => n.entity_type === ENTITY_TYPE_EXPIRATION && n.entity_id === eid
  );
}

/**
 * Creates expiration notifications (3 days before + on day) for food items, idempotent.
 * Fetches existing notifications once to avoid duplicates.
 */
export async function createExpirationNotificationsIfNeeded(
  getInventoryWithExpiration: () => Promise<{ id: string; item: string; expiration_date: string | null }[]>,
  getExistingNotifications: () => Promise<{ entity_type: string | null; entity_id: string | null }[]>
): Promise<void> {
  const items = await getInventoryWithExpiration();
  const foodWithDate = items.filter((i) => i.expiration_date != null);
  if (foodWithDate.length === 0) return;

  const existing = await getExistingNotifications();
  const today = new Date().toISOString().slice(0, 10);
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);

  for (const item of foodWithDate) {
    const expStr = item.expiration_date!.slice(0, 10);

    const createIfMissing = async (
      kind: "3days" | "today",
      title: string,
      body: string
    ): Promise<void> => {
      const has = await hasExistingExpirationNotification(item.id, expStr, kind, existing);
      if (has) return;
      try {
        await notificationsService.createNotification({
          type: "expiration",
          title,
          body,
          entity_type: ENTITY_TYPE_EXPIRATION,
          entity_id: entityId(item.id, expStr, kind),
        });
        existing.push({ entity_type: ENTITY_TYPE_EXPIRATION, entity_id: entityId(item.id, expStr, kind) });
      } catch {
        // skip
      }
    };

    if (expStr === today) {
      await createIfMissing(REMINDER_TODAY, `${item.item} expires today`, `${item.item} expires today`);
    } else if (expStr === in3DaysStr) {
      await createIfMissing(REMINDER_3_DAYS, `${item.item} expires in 3 days`, `${item.item} expires in 3 days`);
    }
  }
}
