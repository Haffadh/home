"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "../../lib/roles";
import { STORAGE_KEY, getStoredRole } from "../../lib/roles";
import { can } from "../../lib/permissions";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:3001";

const SIDEBAR_NAV = [
  { href: "/", label: "Dashboard", permission: "dashboard" as const },
  { href: "/todays-tasks", label: "Today's Tasks", permission: "tasks" as const },
  { href: "/meals", label: "Meals", permission: "meals" as const },
  { href: "/groceries", label: "Groceries", permission: "groceries" as const },
  { href: "/devices", label: "Devices", permission: "devices" as const },
  { href: "/family", label: "Family", permission: "family" as const },
  { href: "/settings", label: "Settings", permission: "settings" as const },
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
      const res = await fetch(`${API_BASE}/weather`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data.tempC === "number") {
        setWeather({
          tempC: data.tempC,
          condition: data.condition || "Clear",
          icon: data.icon || "sun",
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
  const isHome = pathname === "/";

  useEffect(() => {
    if (isHome) {
      document.documentElement.classList.add("home-no-scroll");
    } else {
      document.documentElement.classList.remove("home-no-scroll");
    }
    return () => document.documentElement.classList.remove("home-no-scroll");
  }, [isHome]);

  return (
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
          {SIDEBAR_NAV.map(({ href, label, permission }) => {
            const isActive =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            const allowed = role ? can(role, permission) : true;
            const className = `
              relative rounded-xl px-3.5 py-2.5 text-[0.8125rem] font-medium
              transition-all duration-300 ease-out
              ${!allowed ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"}
              ${isActive
                ? "text-[#6EA8FF] bg-[rgba(110,168,255,0.06)] border border-[rgba(110,168,255,0.15)]"
                : "text-white/60 border border-transparent"
              }
              ${allowed && !isActive ? "hover:text-white/85 hover:bg-white/[0.04]" : ""}
            `;
            if (allowed) {
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
            }
            return (
              <span
                key={href}
                className={className}
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
              >
                <span className="relative">{label}</span>
              </span>
            );
          })}
        </nav>
        <div className="p-3 mt-auto border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
              closeSidebar();
              router.push("/login");
            }}
            className="w-full rounded-xl px-3.5 py-2.5 text-[0.8125rem] font-medium text-white/60 hover:text-white/85 hover:bg-white/[0.04] border border-transparent transition-all duration-300 ease-out text-left"
          >
            Switch Panel
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10">
        <header className="relative h-20 shrink-0 flex items-center justify-between gap-6 px-4 md:px-8 py-3">
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
              className="shrink-0 w-10 h-10 rounded-2xl flex flex-col items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 transition-all duration-300 ease-out hover:scale-[1.02]"
              aria-label="Open menu"
            >
              <span className="w-4 h-0.5 rounded-full bg-white/70" />
              <span className="w-4 h-0.5 rounded-full bg-white/70" />
              <span className="w-4 h-0.5 rounded-full bg-white/70" />
            </button>
            <Link
              href="/"
              onClick={pathname === "/" ? undefined : closeSidebar}
              className="block min-w-0"
            >
              <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent truncate">
                Haffadh Home
              </h1>
            </Link>
          </div>

          <div className="relative flex items-center gap-5 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[0.6875rem] uppercase tracking-wide text-white/50">
                {now
                  ? now.toLocaleDateString(undefined, { weekday: "long" })
                  : "—"}
              </span>
              <span className="text-[0.8125rem] font-medium text-white/80">
                {now
                  ? now.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </span>
              <span
                className="text-xl font-semibold tabular-nums text-white/95 min-w-[7rem] text-right"
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
            <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 backdrop-blur-xl border border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
              {weather ? (
                <>
                  <span className="text-base leading-none opacity-80" aria-hidden>
                    {weatherIcon(weather.icon)}
                  </span>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold tabular-nums text-white/90">
                      {weather.tempC}°
                    </span>
                    <span className="text-[0.6875rem] text-white/50">
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
    </div>
  );
}
