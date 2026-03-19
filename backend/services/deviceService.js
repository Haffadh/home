/**
 * Device service: getDevices, getDeviceStatus, setDeviceState.
 * Uses Home Assistant REST API via hassClient.
 */

import {
  isConfigured,
  fetchAllStates,
  fetchEntityState,
  callService,
} from "./hassClient.js";

const DEVICES_CACHE_TTL_MS = 5000;
let devicesCache = { data: null, ts: 0 };

/** Domains we treat as controllable devices */
const DEVICE_DOMAINS = new Set(["light", "switch", "climate", "cover", "fan", "input_boolean"]);

/** Map HA domain to our device type */
function domainToType(domain) {
  if (domain === "light") return "light";
  if (domain === "climate") return "ac";
  if (domain === "cover") return "blinds";
  if (domain === "fan") return "fan";
  return "switch";
}

/** Extract our normalized device state from a HA entity state object */
function entityToDevice(entity, roomMap) {
  const id = entity.entity_id;
  const domain = id.split(".")[0];
  const attr = entity.attributes || {};
  const isOn = entity.state === "on" || entity.state === "heat" || entity.state === "cool" || entity.state === "heat_cool";

  return {
    id,
    name: attr.friendly_name || id,
    type: domainToType(domain),
    isOnline: entity.state !== "unavailable",
    powerState: entity.state === "unavailable" ? null : isOn,
    brightness: typeof attr.brightness === "number" ? attr.brightness : null,
    temperature: typeof attr.temperature === "number" ? attr.temperature : (typeof attr.current_temperature === "number" ? attr.current_temperature : null),
    fanSpeed: attr.fan_mode || null,
    blindsPosition: typeof attr.current_position === "number" ? attr.current_position : null,
    room: roomMap[id] || attr.area_id || null,
    lastUpdated: entity.last_updated || new Date().toISOString(),
  };
}

function parseDeviceRooms(str) {
  const map = {};
  (str || "").split(",").forEach((pair) => {
    const [id, room] = pair.split(":").map((x) => x.trim());
    if (id && room) map[id] = room;
  });
  return map;
}

/**
 * Get all devices with state. Optional room filter via HASS_DEVICE_ROOMS (entity_id:room, ...).
 */
export async function getDevices(forceRefresh = false) {
  if (!isConfigured()) return [];
  const now = Date.now();
  if (!forceRefresh && devicesCache.data && now - devicesCache.ts < DEVICES_CACHE_TTL_MS) {
    return devicesCache.data;
  }
  const allStates = await fetchAllStates();
  const roomMap = parseDeviceRooms(process.env.HASS_DEVICE_ROOMS || "");
  const devices = allStates
    .filter((e) => DEVICE_DOMAINS.has(e.entity_id.split(".")[0]))
    .map((e) => entityToDevice(e, roomMap));
  devicesCache = { data: devices, ts: now };
  return devices;
}

/**
 * Get status for one device.
 */
export async function getDeviceStatus(deviceId) {
  if (!isConfigured()) throw new Error("Home Assistant not configured");
  const entity = await fetchEntityState(deviceId);
  const roomMap = parseDeviceRooms(process.env.HASS_DEVICE_ROOMS || "");
  return entityToDevice(entity, roomMap);
}

/**
 * Set device state. command: { switch?, brightness?, temperature?, fanSpeed?, blindsOpen? }.
 */
export async function setDeviceState(deviceId, command) {
  if (!deviceId) throw new Error("deviceId required");
  if (!isConfigured()) throw new Error("Home Assistant not configured");

  const domain = deviceId.split(".")[0];
  const entityData = { entity_id: deviceId };

  if (typeof command.switch === "boolean") {
    await callService(domain, command.switch ? "turn_on" : "turn_off", entityData);
  }
  if (typeof command.brightness === "number") {
    const value = Math.max(0, Math.min(255, Math.round(command.brightness)));
    await callService("light", "turn_on", { ...entityData, brightness: value });
  }
  if (typeof command.temperature === "number") {
    const value = Math.max(16, Math.min(30, Math.round(command.temperature)));
    await callService("climate", "set_temperature", { ...entityData, temperature: value });
  }
  if (command.fanSpeed !== undefined && command.fanSpeed !== null) {
    await callService("climate", "set_fan_mode", { ...entityData, fan_mode: String(command.fanSpeed) });
  }
  if (typeof command.blindsOpen === "boolean" || typeof command.blindsOpen === "number") {
    if (typeof command.blindsOpen === "boolean") {
      await callService("cover", command.blindsOpen ? "open_cover" : "close_cover", entityData);
    } else {
      const pos = Math.max(0, Math.min(100, Math.round(command.blindsOpen)));
      await callService("cover", "set_cover_position", { ...entityData, position: pos });
    }
  }

  // Invalidate cache and return fresh state
  devicesCache = { data: null, ts: 0 };
  return getDeviceStatus(deviceId);
}
