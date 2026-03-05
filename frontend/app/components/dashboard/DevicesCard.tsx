"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import { getApiBase, getActorHeaders, withActorBody } from "../../../lib/api";
import { useRealtime, useRealtimeEvent } from "../../context/RealtimeContext";

import { API_BASE } from "@/lib/config";
console.log("API_BASE =", API_BASE);
const DEVICES_FALLBACK_POLL_MS = 20_000;

type Device = {
  id: string;
  name: string;
  isOnline?: boolean;
  online?: boolean;
  powerState?: boolean | null;
  status?: boolean | null;
  lastUpdated?: string;
};

function normalizeDevice(d: Record<string, unknown>): Device {
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? "Unnamed"),
    isOnline: typeof d.isOnline === "boolean" ? d.isOnline : typeof d.online === "boolean" ? d.online : true,
    powerState: typeof d.powerState === "boolean" ? d.powerState : typeof d.status === "boolean" ? d.status : null,
    lastUpdated: typeof d.lastUpdated === "string" ? d.lastUpdated : undefined,
  };
}

function isOn(device: Device): boolean {
  return device.powerState === true || device.status === true;
}

export default function DevicesCard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { connected: wsConnected } = useRealtime() ?? { connected: false };
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");

const res = await fetch(`${API_BASE}/devices`, {
  cache: "no-store",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.devices)) {
        setDevices(data.devices.map(normalizeDevice));
      } else {
        setDevices([]);
      }
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useRealtimeEvent("devices_updated", loadDevices);

  // When WebSocket is disconnected, poll devices every 20s
  useEffect(() => {
    if (wsConnected) {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
      return;
    }
    fallbackPollRef.current = setInterval(loadDevices, DEVICES_FALLBACK_POLL_MS);
    return () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
    };
  }, [wsConnected, loadDevices]);

  async function handleToggle(device: Device) {
    const nextOn = !isOn(device);
    const prevDevices = devices;
    setTogglingId(device.id);
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, powerState: nextOn, status: nextOn } : d))
    );
    try {
      const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(device.id)}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({ on: nextOn })),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.device) {
        setDevices((prev) =>
          prev.map((d) => (d.id === device.id ? normalizeDevice(data.device) : d))
        );
      } else {
        setDevices(prevDevices);
      }
    } catch {
      setDevices(prevDevices);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">Devices</h2>
      </div>
      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : devices.length === 0 ? (
        <p className="text-[0.8125rem] text-white/45">No devices found. Check backend connection.</p>
      ) : (
        <ul className="space-y-2.5">
          {devices.map((d) => {
            const online = d.isOnline !== false;
            const updating = togglingId === d.id;
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] px-3.5 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {updating ? (
                    <span className="shrink-0 w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" title="Updating…" aria-hidden />
                  ) : (
                    <span
                      className="shrink-0 w-2 h-2 rounded-full"
                      title={online ? "Online" : "Offline"}
                      style={{
                        background: online ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium text-white/90 truncate tracking-tight">
                      {d.name}
                    </p>
                    <p className="text-[0.6875rem] text-white/45 mt-0.5">
                      {!online ? "Offline" : typeof d.powerState === "boolean" || typeof d.status === "boolean" ? (isOn(d) ? "On" : "Off") : "—"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(d)}
                  disabled={updating || !online}
                  className={`
                    shrink-0 rounded-xl px-3.5 py-2 text-[0.75rem] font-medium
                    transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-50 border
                    ${
                      isOn(d)
                        ? "bg-[rgba(52,211,153,0.15)] text-emerald-300/95 border-emerald-400/25 hover:bg-[rgba(52,211,153,0.2)]"
                        : "bg-white/10 text-white/80 border-white/10 hover:bg-white/20 hover:text-white/95"
                    }
                  `}
                >
                  {updating ? "…" : isOn(d) ? "On" : "Off"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
