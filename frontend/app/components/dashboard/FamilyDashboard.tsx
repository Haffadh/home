"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredRole, ACTOR_NAME } from "../../../lib/roles";
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
    <div className="w-full pb-24 relative">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative px-6 pt-8 pb-10 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 30% 0%, rgba(168,85,247,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 60% 50% at 80% 10%, rgba(251,191,36,0.04) 0%, transparent 60%)
            `,
          }}
        />
        <div className="relative animate-fade-in-up opacity-0" style={{ animationDelay: "0.05s" }}>
          <p className="text-[0.8125rem] font-medium text-white/35 tracking-wide uppercase mb-2">
            {getGreeting()}
          </p>
          <h1 className="text-[2.25rem] font-bold text-white tracking-tight leading-[1.1]">
            {displayName}
          </h1>
        </div>
      </div>

      {/* ── Scene feedback ────────────────────────────────────────────── */}
      {sceneMessage && (
        <div className="mx-6 mb-5 liquid-glass rounded-2xl px-4 py-3 text-[0.8125rem] text-white/80 text-center animate-fade-in-up">
          {sceneMessage}
        </div>
      )}

      {/* ── Scenes ────────────────────────────────────────────────────── */}
      <section className="mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: "0.12s" }}>
        {scenesLoading ? (
          <div className="flex gap-3 pl-6 pr-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="shrink-0 w-[4.5rem] h-[4.5rem] rounded-2xl liquid-glass-subtle animate-pulse"
              />
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
                  className={`shrink-0 group relative flex flex-col items-center justify-center w-[4.5rem] h-[4.5rem] rounded-2xl transition-all duration-500 active:scale-[0.88] disabled:opacity-25 ${
                    isActive
                      ? "liquid-glass-active shadow-[0_0_24px_rgba(255,255,255,0.06)]"
                      : "liquid-glass-subtle hover:border-white/15"
                  }`}
                >
                  <span className={`text-[1.375rem] leading-none transition-all duration-500 ${
                    isLoading ? "liquid-pulse scale-90" : "group-hover:scale-110 group-active:scale-95"
                  }`}>
                    {s.icon}
                  </span>
                  <span className="text-[0.5625rem] font-medium text-white/50 mt-1.5 text-center leading-tight px-0.5 line-clamp-1">
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-5 space-y-5">

        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.18s" }}>
          <MealsCard readOnly={false} canEditTasks={false} />
        </div>

        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.24s" }}>
          <HouseBrainTasksCard readOnly={false} title="Today" />
        </div>

        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
          <UrgentTasksCard canEditTasks={true} readOnly={false} simplified />
        </div>
      </div>
    </div>
  );
}
