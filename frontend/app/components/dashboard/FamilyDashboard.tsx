"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredRole, ACTOR_NAME, USER_DEFAULT_ROOM } from "../../../lib/roles";
import type { Role } from "../../../lib/roles";
import { getVisibleScenes } from "../../../lib/sceneVisibility";
import { useSceneTrigger } from "../DashboardShell";
import * as scenesService from "../../../lib/services/scenes";
import type { Scene } from "../../../lib/services/scenes";

import GlassCard from "./GlassCard";
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

  return (
    <div className="w-full px-4 py-5 pb-24 space-y-6">

      {/* ── Greeting ──────────────────────────────────────────────────── */}
      <header className="animate-fade-in-up opacity-0 pt-1" style={{ animationDelay: "0.05s" }}>
        <h1 className="text-[1.75rem] font-bold text-white/95 tracking-tight leading-tight">
          {getGreeting()},<br />{displayName}
        </h1>
        <p className="text-[0.875rem] text-white/40 mt-2">{formatDate()}</p>
      </header>

      {/* ── Scenes ────────────────────────────────────────────────────── */}
      <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-[1rem] font-semibold text-white/80 mb-3">Scenes</h2>
        {scenesLoading ? (
          <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        ) : visibleScenes.length === 0 ? (
          <p className="text-[0.875rem] text-white/40">No scenes available.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {visibleScenes.map((s) => {
              const isActive = activeScene === s.id;
              const isLoading = activatingId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => triggerScene(s.id)}
                  disabled={activatingId !== null && activatingId !== s.id}
                  className={`shrink-0 flex flex-col items-center justify-center gap-2 rounded-2xl w-[6rem] h-[6rem] transition-all duration-300 active:scale-[0.93] disabled:opacity-40 border ${
                    isActive
                      ? "bg-emerald-500/15 border-emerald-400/30 shadow-[0_0_16px_rgba(52,211,153,0.2)]"
                      : "bg-[#1e293b]/70 border-white/[0.08] hover:bg-[#1e293b]"
                  }`}
                >
                  <span className="text-[1.75rem] leading-none">{isLoading ? "..." : s.icon}</span>
                  <span className="text-[0.6875rem] font-medium text-white/80 text-center leading-tight px-1 truncate w-full">
                    {s.name}
                  </span>
                  <span className={`text-[0.5rem] leading-none px-1.5 py-0.5 rounded-full ${
                    s.scope === "house"
                      ? "bg-blue-500/15 text-blue-300/70"
                      : "bg-amber-500/15 text-amber-300/70"
                  }`}>
                    {s.scope === "house" ? "House" : s.room}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Meals ─────────────────────────────────────────────────────── */}
      <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.15s" }}>
        <MealsCard readOnly={false} canEditTasks={false} />
      </section>

      {/* ── Today's Tasks ─────────────────────────────────────────────── */}
      <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
        <HouseBrainTasksCard readOnly={false} title="Today's Tasks" />
      </section>

      {/* ── Urgent Requests ───────────────────────────────────────────── */}
      <section className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.25s" }}>
        <UrgentTasksCard canEditTasks={true} readOnly={false} simplified />
      </section>
    </div>
  );
}
