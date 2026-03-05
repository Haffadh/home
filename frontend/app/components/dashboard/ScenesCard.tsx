"use client";

import { useState } from "react";
import GlassCard from "./GlassCard";
import GatheringModal from "./GatheringModal";

import { getApiBase, getActorHeaders, withActorBody } from "../../lib/api";

const API_BASE = getApiBase();

const SCENES = [
  { id: "shower", name: "Shower Mode", emoji: "🚿", description: "Towel heaters ON for 45 min" },
  { id: "away", name: "Away Mode", emoji: "🚪", description: "Doors locked • Lights off" },
  { id: "sleep", name: "Sleep Mode", emoji: "🌙", description: "Lights off • Quiet • AC off" },
  { id: "gathering", name: "Gathering Mode", emoji: "🍷", description: "Prepare living room & snacks" },
] as const;

type ScenesCardProps = { readOnly?: boolean };

export default function ScenesCard({ readOnly = false }: ScenesCardProps = {}) {
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gatheringModalOpen, setGatheringModalOpen] = useState(false);

  async function activate(sceneId: string) {
    if (sceneId === "shower") {
      console.log("Shower Mode – logic to be added later");
      return;
    }
    if (sceneId === "away") {
      console.log("Away Mode – logic to be added later");
      return;
    }
    if (sceneId === "sleep") {
      console.log("Sleep Mode – logic to be added later");
      return;
    }
    if (sceneId === "gathering") {
      setGatheringModalOpen(true);
      return;
    }

    setActivatingId(sceneId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/scenes/${sceneId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({})),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error || `Failed (${res.status})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <>
      <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.05s" }}>
        <div className="mb-5">
          <h2 className="text-[1rem] font-medium text-white/90 tracking-tight">Scenes</h2>
        </div>
        {error && (
          <p className="text-[0.75rem] text-rose-300/80 mb-3">{error}</p>
        )}
        <ul className="space-y-3">
          {SCENES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => activate(s.id)}
                disabled={activatingId !== null || readOnly}
                className="glass-bubble flex w-full items-center gap-4 px-5 py-3.5 text-left disabled:opacity-60"
              >
                <span className="text-xl shrink-0">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-white/90 truncate">{s.name}</p>
                  <p className="text-[0.6875rem] text-white/45 truncate">{s.description}</p>
                </div>
                {activatingId === s.id && (
                  <span className="shrink-0 text-[0.75rem] text-white/50">…</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </GlassCard>
      <GatheringModal
        isOpen={gatheringModalOpen}
        onClose={() => setGatheringModalOpen(false)}
        onSuccess={() => {}}
      />
    </>
  );
}
