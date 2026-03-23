"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import { useSceneTrigger } from "../DashboardShell";
import * as scenesService from "../../../lib/services/scenes";
import type { Scene } from "../../../lib/services/scenes";
import { getStoredRole } from "../../../lib/roles";
import type { Role } from "../../../lib/roles";
import { getVisibleScenes } from "../../../lib/sceneVisibility";

type ScenesCardProps = { readOnly?: boolean };

export default function ScenesCard({ readOnly = false }: ScenesCardProps) {
  const [allScenes, setAllScenes] = useState<Scene[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const ctx = useSceneTrigger();
  const triggerScene = ctx?.triggerScene ?? (async () => {});
  const activatingId = ctx?.activatingId ?? null;
  const activeScene = ctx?.activeScene ?? null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(true);
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 8);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  const loadScenes = useCallback(async () => {
    setLoading(true);
    try {
      const list = await scenesService.fetchScenes();
      setAllScenes(list);
    } catch {
      setAllScenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  const scenes = getVisibleScenes(allScenes, role);

  return (
    <GlassCard className="animate-fade-in-up opacity-0 overflow-hidden" style={{ animationDelay: "0.05s" }}>
      <div className="flex flex-col min-h-0 flex-1 gap-4">
        <h2 className="text-xl font-semibold text-white/90 shrink-0">Scenes</h2>
        {loading ? (
          <p className="text-[0.8125rem] text-white/45">Loading...</p>
        ) : (
          <div className="relative min-h-0 flex-1" style={{ maxHeight: scenes.length > 4 ? "calc(4 * 3.75rem + 3.5 * 0.75rem + 1.5rem)" : undefined }}>
            <div ref={scrollRef} onScroll={handleScroll} className="flex flex-col gap-3 overflow-y-auto min-h-0 h-full no-scrollbar">
              {scenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => triggerScene(s.id, readOnly)}
                  disabled={readOnly || (activatingId !== null && activatingId !== s.id)}
                  className={`w-full shrink-0 h-[3.75rem] rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-lg px-5 transition-all duration-500 active:scale-[0.96] text-left relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-white/5 before:opacity-0 before:transition-opacity active:before:opacity-100 disabled:opacity-60 flex items-center gap-4 border ${
                    activeScene === s.id
                      ? "border-violet-400/30 shadow-[0_0_12px_rgba(167,139,250,0.15)]"
                      : "border-white/10"
                  }`}
                >
                  <span className="text-xl shrink-0 relative z-10" aria-hidden>{s.icon}</span>
                  <div className="min-w-0 flex-1 relative z-10">
                    <p className="text-[0.875rem] font-medium text-white/90 truncate">{s.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white/60 truncate flex-1">{s.description || "Tap to run"}</p>
                      <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full shrink-0 ${
                        s.scope === "house"
                          ? "bg-blue-500/10 text-blue-300/70"
                          : "bg-amber-500/10 text-amber-300/70"
                      }`}>
                        {s.scope === "house" ? "House" : s.room}
                      </span>
                    </div>
                  </div>
                  {activatingId === s.id && (
                    <span className="shrink-0 text-[0.75rem] text-white/50 relative z-10">...</span>
                  )}
                </button>
              ))}
            </div>
            {scenes.length > 4 && fadeTop && (
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#12101e] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
            {scenes.length > 4 && fadeBottom && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#12101e] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
          </div>
        )}
        {!loading && scenes.length === 0 && (
          <p className="text-[0.8125rem] text-white/45">No scenes available.</p>
        )}
      </div>
    </GlassCard>
  );
}
