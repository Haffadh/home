"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { getApiBase } from "../../../lib/api";

type Weather = {
  tempC: number;
  condition: string;
  icon: string;
  location: string;
};

export default function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApiBase("/api/weather", { cache: "no-store" });
      if (data && typeof (data as { tempC?: number }).tempC === "number") {
        const d = data as { tempC: number; condition?: string; icon?: string; location?: string };
        setWeather({
          tempC: d.tempC,
          condition: d.condition || "—",
          icon: d.icon || "sun",
          location: d.location || "—",
        });
      } else {
        setWeather(null);
      }
    } catch {
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.35s" }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">Weather</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[0.6875rem] font-medium text-white/50 hover:text-white/70 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : weather ? (
        <div className="flex items-center gap-4">
          <span className="text-3xl font-light text-white/95 tabular-nums">{weather.tempC}°</span>
          <div>
            <p className="text-[0.875rem] font-medium text-white/90">{weather.condition}</p>
            <p className="text-[0.6875rem] text-white/50">{weather.location}</p>
          </div>
        </div>
      ) : (
        <p className="text-[0.8125rem] text-white/45">Unable to load weather.</p>
      )}
    </GlassCard>
  );
}
