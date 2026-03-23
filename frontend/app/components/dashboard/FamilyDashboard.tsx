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
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "🌙";
  if (hour < 12) return "☀️";
  if (hour < 17) return "🌤️";
  if (hour < 21) return "🌆";
  return "🌙";
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
  const sceneMessage = ctx?.sceneMessage ?? null;

  useEffect(() => { setRole(getStoredRole()); }, []);

  const displayName = role ? (ACTOR_NAME[role as keyof typeof ACTOR_NAME] ?? role) : "";

  const loadScenes = useCallback(async () => {
    setScenesLoading(true);
    try { setScenes(await scenesService.fetchScenes()); }
    catch { setScenes([]); }
    finally { setScenesLoading(false); }
  }, []);

  useEffect(() => { loadScenes(); }, [loadScenes]);

  const visibleScenes = getVisibleScenes(scenes, role);

  return (
    <div className="w-full pb-20 relative">

      {/* ── Hero Greeting ─────────────────────────────────────────────── */}
      <div
        className="relative px-6 pt-6 pb-8"
        style={{
          background: "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%)",
        }}
      >
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0.05s" }}
        >
          <p className="text-[0.8125rem] text-white/40 mb-1">{getGreetingEmoji()} {getGreeting()}</p>
          <h1 className="text-[2rem] font-bold text-white tracking-tight leading-none">
            {displayName}
          </h1>
        </div>
      </div>

      {/* ── Scene toast ───────────────────────────────────────────────── */}
      {sceneMessage && (
        <div className="mx-6 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-4 py-3 text-[0.8125rem] text-emerald-300/90 text-center animate-fade-in-up">
          {sceneMessage}
        </div>
      )}

      {/* ── Scenes ────────────────────────────────────────────────────── */}
      <section
        className="mb-6 animate-fade-in-up opacity-0"
        style={{ animationDelay: "0.1s" }}
      >
        {scenesLoading ? (
          <div className="flex gap-3 px-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shrink-0 w-20 h-20 rounded-[1.25rem] bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : visibleScenes.length > 0 && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pl-6 pr-6">
            {visibleScenes.map((s) => {
              const isActive = activeScene === s.id;
              const isLoading = activatingId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => triggerScene(s.id)}
                  disabled={activatingId !== null && activatingId !== s.id}
                  className={`shrink-0 group relative flex flex-col items-center justify-center w-20 h-20 rounded-[1.25rem] transition-all duration-300 active:scale-[0.9] disabled:opacity-30 ${
                    isActive
                      ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 shadow-[0_0_20px_rgba(52,211,153,0.2)] ring-1 ring-emerald-400/30"
                      : "bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <span className={`text-[1.5rem] leading-none transition-transform duration-300 ${isLoading ? "animate-pulse scale-75" : "group-hover:scale-110"}`}>
                    {s.icon}
                  </span>
                  <span className="text-[0.625rem] font-medium text-white/60 mt-1.5 text-center leading-tight px-1 line-clamp-2">
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Cards ─────────────────────────────────────────────────────── */}
      <div className="px-4 space-y-4">

        {/* Meals */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0.15s" }}
        >
          <MealsCard readOnly={false} canEditTasks={false} />
        </div>

        {/* Tasks */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0.2s" }}
        >
          <HouseBrainTasksCard readOnly={false} title="Today" />
        </div>

        {/* Urgent */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0.25s" }}
        >
          <UrgentTasksCard canEditTasks={true} readOnly={false} simplified />
        </div>
      </div>
    </div>
  );
}
