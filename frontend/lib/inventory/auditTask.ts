/**
 * Inventory audit detection: 7 days after a "Large Shopping" event (see largeShopping.ts),
 * we create a one-off "Inventory Audit" task and an inventory_audit_due notification.
 * Idempotent: checks for existing task/notification before creating; no duplicates.
 */

import * as groceriesService from "../services/groceries";
import * as tasksService from "../services/tasks";
import * as notificationsService from "../services/notifications";
import { detectLargeShoppingEvent, getNextAuditDate, shouldCreateInventoryAuditTask } from "./largeShopping";
import { getInventoryAuditTaskDurationMinutes } from "./largeShopping";
import { ensureInventoryAuditDueNotificationIfNeeded } from "./auditNotification";

const INVENTORY_AUDIT_TITLE = "Inventory Audit";

/**
 * Checks for a Large Shopping event in recent groceries, and if the audit date
 * has no existing "Inventory Audit" task, creates one (1-hour, is_auto_generated).
 * Then ensures an inventory_audit_due notification exists for that date (idempotent).
 */
export async function ensureInventoryAuditTaskIfNeeded(): Promise<void> {
  const groceries = await groceriesService.fetchGroceries();
  const largeShoppingDate = detectLargeShoppingEvent(groceries);
  if (!largeShoppingDate) return;

  const auditDate = getNextAuditDate(largeShoppingDate);
  const tasksOnAuditDate = await tasksService.fetchTasks({
    date: auditDate,
  });
  const hasExisting =
    tasksOnAuditDate.some(
      (t) => t.title === INVENTORY_AUDIT_TITLE && t.is_auto_generated === true
    );

  if (!shouldCreateInventoryAuditTask(auditDate, hasExisting)) return;

  const again = await tasksService.fetchTasks({ date: auditDate });
  if (again.some((t) => t.title === INVENTORY_AUDIT_TITLE && t.is_auto_generated === true)) return;

  const durationMin = getInventoryAuditTaskDurationMinutes();
  const start = new Date(`${auditDate}T09:00:00`);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  await tasksService.createTask({
    title: INVENTORY_AUDIT_TITLE,
    assigned_by: "Abdullah",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration: durationMin,
    room: null,
    urgent: false,
    is_auto_generated: true,
  });

  await ensureInventoryAuditDueNotificationIfNeeded(auditDate, () =>
    notificationsService.fetchNotifications().then((rows) =>
      rows.map((r) => ({ type: r.type, entity_type: r.entity_type, entity_id: r.entity_id }))
    )
  );
}
