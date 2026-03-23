"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredRole, ACTOR_NAME, USER_DEFAULT_ROOM } from "../../../lib/roles";
import type { Role } from "../../../lib/roles";
import { getVisibleScenes } from "../../../lib/sceneVisibility";
import { useSceneTrigger } from "../DashboardShell";
import * as scenesService from "../../../lib/services/scenes";
import type { Scene } from "../../../lib/services/scenes";

import MealsCard from "./MealsCard";
import HouseBrainTasksCard from "./HouseBrainTasksCard";
import UrgentTasksCard from "./UrgentTasksCard";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function FamilyDashboard() {
  const [role, setRole] = useState<Role | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(true);

  const ctx = useSceneTrigger();
  const triggerScene = ctx?.triggerScene ?? (async () => {});
  const activatingId = ctx?.activatingId ?? null;
  const activeScene = ctx?.activeScene ?? null;

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  const displayName = role ? (ACTOR_NAME[role as keyof typeof ACTOR_NAME] ?? role) : "";
  const userRoom = role ? (USER_DEFAULT_ROOM[role] ?? null) : null;

  /* ── Load scenes ──────────────────────────────────────────────────────── */

  const loadScenes = useCallback(async () => {
    setScenesLoading(true);
    try {
      const all = await scenesService.fetchScenes();
      setScenes(all);
    } catch {
      setScenes([]);
    } finally {
      setScenesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  const visibleScenes = getVisibleScenes(scenes, role);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5 w-full max-w-[430px] mx-auto px-4 py-5 min-h-0 flex-1 overflow-auto no-scrollbar">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <header className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.05s" }}>
        <h1 className="text-2xl font-semibold text-white/95 tracking-tight">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-[0.875rem] text-white/45 mt-1">{formatDate()}</p>
        {userRoom && (
          <p className="text-[0.75rem] text-white/30 mt-0.5">{userRoom}</p>
        )}
      </header>

      {/* ── Scenes (horizontal scroll) ────────────────────────────────────── */}
      <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-[0.9375rem] font-medium text-white/70 mb-3">Scenes</h2>
        {scenesLoading ? (
          <p className="text-[0.8125rem] text-white/40">Loading...</p>
        ) : visibleScenes.length === 0 ? (
          <p className="text-[0.8125rem] text-white/40">No scenes available.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
            {visibleScenes.map((s) => {
              const isActive = activeScene === s.id;
              const isLoading = activatingId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => triggerScene(s.id)}
                  disabled={activatingId !== null && activatingId !== s.id}
                  className={`snap-start shrink-0 flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3 min-w-[5.5rem] transition-all duration-300 active:scale-95 disabled:opacity-50 border ${
                    isActive
                      ? "bg-emerald-500/10 border-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
                      : "bg-[#1e293b]/60 border-white/[0.06] hover:bg-[#1e293b]/80"
                  }`}
                >
                  <span className="text-2xl">{isLoading ? "..." : s.icon}</span>
                  <span className="text-[0.75rem] font-medium text-white/85 text-center leading-tight">{s.name}</span>
                  <span className={`text-[0.5625rem] px-1.5 py-0.5 rounded-full ${
                    s.scope === "house"
                      ? "bg-blue-500/10 text-blue-300/60"
                      : "bg-amber-500/10 text-amber-300/60"
                  }`}>
                    {s.scope === "house" ? "House" : s.room}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Meals ─────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.15s" }}>
        <MealsCard readOnly={false} canEditTasks={false} />
      </div>

      {/* ── Today's Tasks ─────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
        <HouseBrainTasksCard readOnly={false} title="Today's Tasks" />
      </div>

      {/* ── Urgent Requests ───────────────────────────────────────────────── */}
      <div className="animate-fade-in-up opacity-0 pb-6" style={{ animationDelay: "0.25s" }}>
        <UrgentTasksCard canEditTasks={true} readOnly={false} simplified />
      </div>
    </div>
  );
}
