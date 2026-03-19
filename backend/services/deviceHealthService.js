/**
 * Device health: observe device state only. Does not control devices.
 * Unhealthy when: getDeviceStatus throws, status indicates offline, or last update > 10 minutes.
 */

import * as deviceService from "./deviceService.js";

const STALE_MS = 10 * 60 * 1000; // 10 minutes

function isOffline(status) {
  if (status == null) return true;
  if (status.isOnline === false) return true;
  const raw = status.raw;
  if (raw?.device?.online === false || raw?.device?.is_online === false) return true;
  const str = JSON.stringify(status).toLowerCase();
  return str.includes("offline");
}

function isStale(status) {
  const raw = status?.raw?.device;
  if (!raw) return false;
  const ts = raw.last_online_time ?? raw.active_time ?? raw.update_time;
  if (ts == null) return false;
  const ms = typeof ts === "number" ? ts : parseInt(ts, 10);
  if (Number.isNaN(ms)) return false;
  const date = ms < 1e12 ? new Date(ms) : new Date(ms);
  return Date.now() - date.getTime() > STALE_MS;
}

/**
 * Check one device. Returns { deviceId, deviceName, healthy, reason }.
 * Unhealthy when: getDeviceStatus throws, status contains "offline", or last update > 10 minutes.
 */
export async function checkDeviceHealth(device) {
  const deviceId = device?.id ?? device?.deviceId;
  const deviceName = device?.name ?? "Unnamed";

  if (!deviceId) {
    return { deviceId: "", deviceName, healthy: true, reason: "" };
  }

  let status;
  try {
    status = await deviceService.getDeviceStatus(deviceId);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Unreachable";
    return { deviceId, deviceName, healthy: false, reason };
  }

  if (isOffline(status)) {
    return { deviceId, deviceName, healthy: false, reason: "Offline" };
  }
  if (isStale(status)) {
    return { deviceId, deviceName, healthy: false, reason: "Last update over 10 minutes ago" };
  }

  return { deviceId, deviceName, healthy: true, reason: "" };
}
