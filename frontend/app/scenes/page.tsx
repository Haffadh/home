"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as scenesService from "../../lib/services/scenes";
import * as devicesService from "../../lib/services/devices";
import type { Scene } from "../../lib/services/scenes";
import type { Device } from "../../lib/services/devices";
import SceneEditorModal from "../components/scenes/SceneEditorModal";

export default function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editorScene, setEditorScene] = useState<Scene | null | "new">(null);

  const loadScenes = useCallback(async () => {
    try {
      const list = await scenesService.fetchScenes();
      setScenes(list);
    } catch {
      setScenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const list = await devicesService.fetchDevices();
      setDevices(list);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  useEffect(() => {
    if (editorScene !== null) loadDevices();
  }, [editorScene, loadDevices]);

  async function handleRun(sceneId: string) {
    setRunningId(sceneId);
    setRunMessage(null);
    try {
      const result = await scenesService.runScene(sceneId);
      setRunMessage(result.message);
      setTimeout(() => setRunMessage(null), 3000);
    } catch {
      setRunMessage("Run failed");
    } finally {
      setRunningId(null);
    }
  }

  async function handleSave(payload: {
    name: string;
    icon: string;
    description: string;
    actions: Scene["actions"];
    schedule: Scene["schedule"];
  }) {
    if (editorScene === "new") {
      await scenesService.createScene(payload);
    } else if (editorScene && typeof editorScene === "object") {
      await scenesService.updateScene(editorScene.id, payload);
    }
    await loadScenes();
  }

  async function handleDelete(sceneId: string) {
    try {
      await scenesService.deleteScene(sceneId);
      setDeleteConfirmId(null);
      await loadScenes();
    } catch {
      // keep confirm open or show toast
    }
  }

  function scheduleStatus(scene: Scene): string {
    if (!scene.schedule?.enabled) return "Not scheduled";
    const days = scene.schedule.daysOfWeek?.length;
    const time = scene.schedule.time || "—";
    return days ? `${time} · ${days} days` : time;
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white/95 tracking-tight">Scenes</h1>
          <p className="text-[0.8125rem] text-white/55 mt-1">Create, edit, and run automation scenes</p>
        </div>
        <div className="flex items-center gap-3">
          {runMessage && (
            <span className="text-sm text-emerald-300/95 rounded-xl bg-emerald-500/10 px-3 py-2 border border-emerald-400/20">
              {runMessage}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditorScene("new")}
            className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition"
          >
            + New Scene
          </button>
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[0.8125rem] font-medium text-white/80 hover:bg-white/10 transition"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : scenes.length === 0 ? (
        <div className="rounded-3xl bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 p-8 text-center">
          <p className="text-white/60 mb-4">No scenes yet.</p>
          <button
            type="button"
            onClick={() => setEditorScene("new")}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition"
          >
            Create your first scene
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {scenes.map((scene) => (
            <li
              key={scene.id}
              className="rounded-3xl bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 overflow-hidden transition hover:bg-[#0f172a]/80"
            >
              <div className="p-5 flex flex-wrap items-center gap-4">
                <span className="text-2xl shrink-0" aria-hidden>{scene.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-white/95">{scene.name}</p>
                  <p className="text-[0.8125rem] text-white/55 truncate">{scene.description || "No description"}</p>
                  <p className="text-[0.6875rem] text-white/45 mt-1">{scheduleStatus(scene)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRun(scene.id)}
                    disabled={runningId !== null}
                    className="rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-50 px-4 py-2 text-[0.8125rem] font-medium text-white transition"
                  >
                    {runningId === scene.id ? "…" : "Run"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorScene(scene)}
                    className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-[0.8125rem] font-medium text-white/90 transition"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === scene.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(scene.id)}
                        className="rounded-xl bg-rose-600/80 hover:bg-rose-500/80 px-3 py-1.5 text-[0.75rem] font-medium text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-xl bg-white/10 px-3 py-1.5 text-[0.75rem] text-white/80"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(scene.id)}
                      className="rounded-xl bg-white/10 hover:bg-rose-500/20 px-4 py-2 text-[0.8125rem] font-medium text-white/80 hover:text-rose-300 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorScene !== null && (
        <SceneEditorModal
          scene={editorScene === "new" ? null : editorScene}
          devices={devices}
          onClose={() => setEditorScene(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
