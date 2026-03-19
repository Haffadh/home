/**
 * Device health check loop: every 2 minutes, check all devices and create
 * one notification per unhealthy device. Duplicate prevention via entity_id.
 */

import * as deviceService from "./deviceService.js";
import * as deviceHealthService from "./deviceHealthService.js";
import {
  getSupabaseAdmin,
  hasUnreadNotificationByEntityId,
  createDeviceHealthNotification,
} from "../lib/supabaseAdmin.js";

const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const ENTITY_TYPE = "device";

function entityId(deviceId) {
  return `device_health:${deviceId}`;
}

async function ensureNotificationForUnhealthy(health) {
  const eid = entityId(health.deviceId);
  const exists = await hasUnreadNotificationByEntityId(eid);
  if (exists) return;

  const title = "Device offline";
  const body = `${health.deviceName} appears to be offline or unreachable.`;

  await createDeviceHealthNotification({
    type: "device_health",
    title,
    body,
    entity_type: ENTITY_TYPE,
    entity_id: eid,
  });
}

/**
 * One run: load devices, check health, create notifications for unhealthy (no duplicate).
 */
async function runHealthCheck() {
  let devices = [];
  try {
    devices = await deviceService.getDevices(true);
  } catch (e) {
    return;
  }

  const unhealthy = [];
  for (const device of devices) {
    const health = await deviceHealthService.checkDeviceHealth(device);
    if (!health.healthy) unhealthy.push(health);
  }

  for (const h of unhealthy) {
    try {
      await ensureNotificationForUnhealthy(h);
    } catch (e) {
      // skip one device
    }
  }
}

let intervalId = null;

/**
 * Start the device health scheduler. Runs every 2 minutes.
 * Pass db and deps for future use; currently uses deviceService and supabaseAdmin.
 */
export function startDeviceHealthScheduler(db, deps = {}) {
  if (intervalId != null) return;

  runHealthCheck().catch(() => {});

  intervalId = setInterval(() => {
    runHealthCheck().catch(() => {});
  }, INTERVAL_MS);
}

export function stopDeviceHealthScheduler() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
