/**
 * Device service: getDevices, getDeviceStatus, setDeviceState.
 * Ported from backend/services/deviceService.js.
 */

import { isConfigured, fetchAllStates, fetchEntityState, callService } from "./hassClient";

export type Device = {
  id: string;
  name: string;
  type: string;
  isOnline: boolean;
  powerState: boolean | null;
  brightness: number | null;
  temperature: number | null;
  fanSpeed: string | null;
  blindsPosition: number | null;
  room: string | null;
  lastUpdated: string;
};

const DEVICE_DOMAINS = new Set(["light", "switch", "climate", "cover", "fan", "input_boolean"]);

function domainToType(domain: string): string {
  if (domain === "light") return "light";
  if (domain === "climate") return "ac";
  if (domain === "cover") return "blinds";
  if (domain === "fan") return "fan";
  return "switch";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entityToDevice(entity: any, roomMap: Record<string, string>): Device {
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

function parseDeviceRooms(str: string): Record<string, string> {
  const map: Record<string, string> = {};
  (str || "").split(",").forEach((pair) => {
    const [id, room] = pair.split(":").map((x) => x.trim());
    if (id && room) map[id] = room;
  });
  return map;
}

export async function getDevices(forceRefresh = false): Promise<Device[]> {
  if (!isConfigured()) return [];
  const allStates = await fetchAllStates();
  const roomMap = parseDeviceRooms(process.env.HASS_DEVICE_ROOMS || "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allStates
    .filter((e: any) => DEVICE_DOMAINS.has(e.entity_id.split(".")[0]))
    .map((e: any) => entityToDevice(e, roomMap));
}

export async function getDeviceStatus(deviceId: string): Promise<Device> {
  if (!isConfigured()) throw new Error("Home Assistant not configured");
  const entity = await fetchEntityState(deviceId);
  const roomMap = parseDeviceRooms(process.env.HASS_DEVICE_ROOMS || "");
  return entityToDevice(entity, roomMap);
}

export async function setDeviceState(deviceId: string, command: Record<string, unknown>): Promise<Device> {
  if (!deviceId) throw new Error("deviceId required");
  if (!isConfigured()) throw new Error("Home Assistant not configured");

  const domain = deviceId.split(".")[0];
  const entityData = { entity_id: deviceId };

  if (typeof command.switch === "boolean") {
    await callService(domain, command.switch ? "turn_on" : "turn_off", entityData);
  }
  if (typeof command.brightness === "number") {
    const value = Math.max(0, Math.min(255, Math.round(command.brightness as number)));
    await callService("light", "turn_on", { ...entityData, brightness: value });
  }
  if (typeof command.temperature === "number") {
    const value = Math.max(16, Math.min(30, Math.round(command.temperature as number)));
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

  return getDeviceStatus(deviceId);
}
