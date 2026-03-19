"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import { useRealtime, useRealtimeEvent } from "../../context/RealtimeContext";
import * as devicesService from "../../../lib/services/devices";
import type { Device } from "../../../lib/services/devices";

const DEVICES_FALLBACK_POLL_MS = 20_000;
const BRIGHTNESS_DEBOUNCE_MS = 400;

function isOn(device: Device): boolean {
  return device.powerState === true;
}

export default function DevicesCard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const brightnessTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { connected: wsConnected } = useRealtime() ?? { connected: false };
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await devicesService.fetchDevices();
      setDevices(data ?? []);
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
      Object.values(brightnessTimeoutRef.current).forEach(clearTimeout);
      brightnessTimeoutRef.current = {};
    };
  }, [wsConnected, loadDevices]);

  async function handleToggle(device: Device) {
    const nextOn = !isOn(device);
    const prevDevices = devices;
    setTogglingId(device.id);
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, powerState: nextOn } : d))
    );
    try {
      const updated = await devicesService.setDeviceState(device.id, { switch: nextOn });
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? updated : d))
      );
    } catch {
      setDevices(prevDevices);
    } finally {
      setTogglingId(null);
    }
  }

  function handleBrightnessChange(device: Device, value: number) {
    const pct = Math.max(0, Math.min(100, value));
    const bright = Math.round((pct / 100) * 255) || 1;
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, brightness: bright } : d))
    );
    if (brightnessTimeoutRef.current[device.id]) {
      clearTimeout(brightnessTimeoutRef.current[device.id]);
    }
    brightnessTimeoutRef.current[device.id] = setTimeout(async () => {
      try {
        const updated = await devicesService.setDeviceState(device.id, { brightness: bright });
        setDevices((prev) =>
          prev.map((d) => (d.id === device.id ? updated : d))
        );
      } catch {
        // revert on error: refetch
        loadDevices();
      }
      delete brightnessTimeoutRef.current[device.id];
    }, BRIGHTNESS_DEBOUNCE_MS);
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
            const isLight = d.type === "light" && d.brightness != null;
            const brightnessPct = d.brightness != null ? Math.round((d.brightness / 255) * 100) : 50;
            return (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] px-3.5 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
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
                        {!online ? "Offline" : typeof d.powerState === "boolean" ? (isOn(d) ? "On" : "Off") : "—"}
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
                          : "bg-[#1e293b]/60 text-white/80 border-white/10 hover:bg-[#1e293b]/80 hover:text-white/95"
                      }
                    `}
                  >
                    {updating ? "…" : isOn(d) ? "On" : "Off"}
                  </button>
                </div>
                {isLight && online && (
                  <div className="flex items-center gap-2 pl-5">
                    <span className="text-[0.6875rem] text-white/45 w-8">Dim</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={brightnessPct}
                      disabled={!isOn(d)}
                      onChange={(e) => handleBrightnessChange(d, Number(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none bg-white/15 accent-emerald-400"
                    />
                    <span className="text-[0.6875rem] text-white/45 w-8">Bright</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
