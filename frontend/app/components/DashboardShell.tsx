"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Role } from "../../lib/roles";
import { ROLE_LABELS, getStoredRole } from "../../lib/roles";
import { can } from "../../lib/permissions";
import { getApiBase } from "../../lib/api";
import GatheringModal from "./dashboard/GatheringModal";
import UrgentAlertOverlay from "./dashboard/UrgentAlertOverlay";
import NotificationBell from "./NotificationBell";
import MusicControl from "./MusicControl";

type SceneTriggerContextValue = {
  triggerScene: (id: string, readOnly?: boolean) => Promise<void>;
  activatingId: string | null;
  activeScene: string | null;
  sceneError: string | null;
  /** Message after scene run (e.g. "Good Night scene activated"); cleared after a few seconds */
  sceneMessage: string | null;
};

const SceneTriggerContext = createContext<SceneTriggerContextValue | null>(null);

export function useSceneTrigger() {
  const ctx = useContext(SceneTriggerContext);
  return ctx;
}

const SIDEBAR_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/scenes", label: "Scenes" },
  { href: "/notifications", label: "Notifications" },
  { href: "/devices", label: "Devices" },
  { href: "/panels", label: "Switch Panels" },
];

function weatherIcon(icon: string): string {
  if (icon === "rain") return "🌧";
  if (icon === "cloud") return "☁";
  return "☀";
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [weather, setWeather] = useState<{ tempC: number; condition: string; icon: string } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const lastDateRef = useRef<string | null>(null);
  const [gatheringOpen, setGatheringOpen] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneMessage, setSceneMessage] = useState<string | null>(null);

  const triggerScene = useCallback(async (id: string, readOnly?: boolean) => {
    if (id === "gathering") {
      setGatheringOpen(true);
      return;
    }
    if (readOnly) return;
    setActivatingId(id);
    setSceneError(null);
    setSceneMessage(null);
    try {
      const data = await getApiBase(`/api/scenes/${encodeURIComponent(id)}/run`, { method: "POST", body: {} }) as { ok?: boolean; message?: string };
      if (!data?.ok) throw new Error(data?.message || "Scene failed");
      setActiveScene(id);
      setSceneMessage(data?.message ?? `${id} scene activated`);
      setTimeout(() => {
        setActiveScene(null);
        setSceneMessage(null);
      }, 2500);
    } catch (err) {
      setSceneError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setActivatingId(null);
    }
  }, []);

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      const newNow = new Date();
      setNow(newNow);
      const todayString = newNow.toDateString();
      if (lastDateRef.current && lastDateRef.current !== todayString) {
        window.dispatchEvent(new CustomEvent("midnight-rollover"));
      }
      lastDateRef.current = todayString;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadWeather = useCallback(async () => {
    try {
      const data = await getApiBase("/api/weather", { cache: "no-store" });
      if (data && typeof (data as { tempC?: number }).tempC === "number") {
        const d = data as { tempC: number; condition?: string; icon?: string };
        setWeather({
          tempC: d.tempC,
          condition: d.condition || "Clear",
          icon: d.icon || "sun",
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const closeSidebar = () => setSidebarOpen(false);
  const isHome = pathname === "/" || pathname.startsWith("/panel/");
  const isRoomPanel = /^\/panel\/(winklevi_room|mariam_room|master_bedroom|dining_room|living_room)$/.test(pathname);
  const roomSegment = pathname.replace(/^\/panel\//, "");
  const roomName = isRoomPanel && roomSegment ? (ROLE_LABELS[roomSegment as Role] ?? roomSegment) : null;
  useEffect(() => {
    if (isRoomPanel) setSidebarOpen(false);
  }, [isRoomPanel]);

  useEffect(() => {
    if (isHome) {
      document.documentElement.classList.add("home-no-scroll");
    } else {
      document.documentElement.classList.remove("home-no-scroll");
    }
    return () => document.documentElement.classList.remove("home-no-scroll");
  }, [isHome]);

  return (
    <SceneTriggerContext.Provider value={{ triggerScene, activatingId, activeScene, sceneError, sceneMessage }}>
    <div className={`flex h-screen flex-col text-white relative z-10 ${isHome ? "overflow-hidden" : "min-h-full"}`}>
      <div
        role="presentation"
        className="fixed inset-0 z-40 transition-opacity duration-300 ease-out"
        style={{
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
          background: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={closeSidebar}
        onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
      />

      <aside
        className="fixed left-0 z-50 w-56 flex flex-col transition-transform duration-300 ease-out rounded-r-2xl"
        style={{
          top: "4rem",
          height: "min(320px, calc(100vh - 6rem))",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          background: "rgba(18, 24, 38, 0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255, 255, 255, 0.05)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: "4px 0 24px rgba(0, 0, 0, 0.15)",
        }}
      >
        <div className="p-4 border-b border-white/[0.05]">
          <Link
            href="/"
            onClick={closeSidebar}
            className="font-medium text-[0.9375rem] text-white/90 hover:text-white transition-colors duration-200"
          >
            Haffadh Home
          </Link>
        </div>
        <nav className="p-3 flex flex-col gap-0.5">
          {SIDEBAR_NAV.map(({ href, label }) => {
            const isActive =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            const className = `
              relative rounded-xl px-3.5 py-2.5 text-[0.8125rem] font-medium
              transition-all duration-300 ease-out hover:scale-[1.02]
              ${isActive
                ? "text-[#6EA8FF] bg-[rgba(110,168,255,0.06)] border border-[rgba(110,168,255,0.15)]"
                : "text-white/60 border border-transparent hover:text-white/85 hover:bg-[#0f172a]/50"
              }
            `;
            return (
              <Link
                key={href}
                href={href}
                onClick={closeSidebar}
                className={className}
              >
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10">
        <header className="relative h-24 shrink-0 flex items-center justify-between gap-6 px-4 md:px-8 py-4">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 100% 120% at 50% -20%, rgba(59, 130, 246, 0.08), transparent 60%)",
            }}
          />
          <div className="relative flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 w-10 h-10 rounded-2xl flex flex-col items-center justify-center gap-1.5 bg-[#0f172a]/70 hover:bg-[#0f172a]/80 transition-all duration-300 ease-out hover:scale-[1.02]"
              aria-label="Open menu"
            >
              <span className="w-4 h-0.5 rounded-full bg-slate-400" />
              <span className="w-4 h-0.5 rounded-full bg-slate-400" />
              <span className="w-4 h-0.5 rounded-full bg-slate-400" />
            </button>
            <Link
              href="/"
              onClick={pathname === "/" ? undefined : closeSidebar}
              className="block min-w-0"
            >
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent truncate">
                {roomName ?? "Haffadh Home"}
              </h1>
            </Link>
          </div>

          <div className="relative flex items-center gap-3 md:gap-5 shrink-0">
            <MusicControl />
            <NotificationBell />
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[0.875rem] uppercase tracking-wide text-white/50">
                {now
                  ? now.toLocaleDateString(undefined, { weekday: "long" })
                  : "—"}
              </span>
              <span className="text-[1rem] font-medium text-white/80">
                {now
                  ? now.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </span>
              <span
                className="text-3xl font-bold tabular-nums text-white/95 min-w-[9rem] text-right"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {now
                  ? now.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "—:—:—"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#0f172a]/70 px-4 py-2 backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
              {weather ? (
                <>
                  <span className="text-xl leading-none opacity-80" aria-hidden>
                    {weatherIcon(weather.icon)}
                  </span>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-lg font-bold tabular-nums text-white/90">
                      {weather.tempC}°
                    </span>
                    <span className="text-[0.875rem] text-white/50">
                      {weather.condition}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-sm text-white/40">—°</span>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isHome ? "overflow-hidden" : "overflow-auto"}`}>
          {children}
        </main>
      </div>
      <GatheringModal
        open={gatheringOpen}
        onClose={() => setGatheringOpen(false)}
      />
      <UrgentAlertOverlay />
    </div>
    </SceneTriggerContext.Provider>
  );
}
