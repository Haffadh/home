/**
 * Device control service. Uses GET/POST /api/devices.
 */

import { getApiBase } from "../api";

export type DeviceType = "light" | "ac" | "blinds" | "switch";

export type Device = {
  id: string;
  name: string;
  type: DeviceType;
  isOnline: boolean;
  powerState: boolean | null;
  brightness: number | null;
  temperature: number | null;
  fanSpeed: unknown;
  blindsPosition: number | null;
  room: string | null;
  lastUpdated: string;
};

export type DeviceStatus = Device & {
  status?: { code: string; value: unknown }[];
};

export type DeviceCommand = {
  switch?: boolean;
  brightness?: number;
  temperature?: number;
  fanSpeed?: string | number;
  blindsOpen?: boolean;
};

function mapDevice(d: Record<string, unknown>): Device {
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? "Unnamed"),
    type: (d.type as DeviceType) ?? "switch",
    isOnline: typeof d.isOnline === "boolean" ? d.isOnline : true,
    powerState: typeof d.powerState === "boolean" ? d.powerState : null,
    brightness: typeof d.brightness === "number" ? d.brightness : null,
    temperature: typeof d.temperature === "number" ? d.temperature : null,
    fanSpeed: d.fanSpeed,
    blindsPosition: typeof d.blindsPosition === "number" ? d.blindsPosition : null,
    room: typeof d.room === "string" ? d.room : null,
    lastUpdated: typeof d.lastUpdated === "string" ? d.lastUpdated : new Date().toISOString(),
  };
}

export async function fetchDevices(room?: string): Promise<Device[]> {
  console.log("[devices] Fetching devices...");
  const path = room ? `/api/devices?room=${encodeURIComponent(room)}` : "/api/devices";
  try {
    const data = await getApiBase(path, { cache: "no-store" }) as { ok?: boolean; devices?: Record<string, unknown>[] };
    const list = Array.isArray(data?.devices) ? data.devices : [];
    return list.map(mapDevice);
  } catch (e) {
    console.error("[devices] fetchDevices", e);
    throw e;
  }
}

export async function fetchDeviceStatus(deviceId: string): Promise<DeviceStatus> {
  try {
    const data = await getApiBase(`/api/devices/${encodeURIComponent(deviceId)}/status`, { cache: "no-store" }) as { ok?: boolean; device?: Record<string, unknown> };
    const d = data?.device;
    if (!d) throw new Error("Device not found");
    return { ...mapDevice(d), status: d.status as DeviceStatus["status"] };
  } catch (e) {
    console.error("[devices] fetchDeviceStatus", deviceId, e);
    throw e;
  }
}

export async function setDeviceState(deviceId: string, command: DeviceCommand): Promise<Device> {
  try {
    const data = await getApiBase(`/api/devices/${encodeURIComponent(deviceId)}/control`, {
      method: "POST",
      body: command,
    }) as { ok?: boolean; device?: Record<string, unknown> };
    const d = data?.device;
    if (!d) throw new Error("Control failed");
    return mapDevice(d);
  } catch (e) {
    console.error("[devices] setDeviceState", deviceId, e);
    throw e;
  }
}
