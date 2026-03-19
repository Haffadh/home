/**
 * Idempotent inventory_audit_due notification when an audit task is created/scheduled.
 */

import * as notificationsService from "../services/notifications";

const ENTITY_TYPE_AUDIT_DUE = "inventory_audit_due";

/**
 * Creates an "Inventory audit due" notification for the given audit date if one does not exist.
 */
export async function ensureInventoryAuditDueNotificationIfNeeded(
  auditDate: string,
  getExistingNotifications: () => Promise<{ type: string; entity_type: string | null; entity_id: string | null }[]>
): Promise<void> {
  const existing = await getExistingNotifications();
  const has = existing.some(
    (n) => n.type === "inventory_audit_due" && n.entity_id === auditDate
  );
  if (has) return;
  try {
    await notificationsService.createNotification({
      type: "inventory_audit_due",
      title: "Inventory audit due",
      body: `Inventory audit scheduled for ${auditDate}`,
      entity_type: ENTITY_TYPE_AUDIT_DUE,
      entity_id: auditDate,
    });
  } catch {
    // skip
  }
}
