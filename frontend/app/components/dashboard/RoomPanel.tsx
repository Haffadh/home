"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TASK_CATEGORIES } from "../../../lib/taskCategories";
import { getCategoryIcon } from "../../../lib/taskCategories";
import { useRealtimeTable } from "../../../lib/useRealtimeTable";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import * as tasksService from "../../../lib/services/tasks";
import * as devicesService from "../../../lib/services/devices";
import * as scenesService from "../../../lib/services/scenes";
import type { Device } from "../../../lib/services/devices";
import type { Scene } from "../../../lib/services/scenes";
import { getRoomScenes } from "../../../lib/sceneVisibility";
import { useSceneTrigger } from "../DashboardShell";
import { taskRowsToUI } from "../../../lib/adapters/tasks";
import type { UITask } from "../../../lib/adapters/tasks";
import { formatTaskTimeRange } from "../../../lib/scheduling/formatTaskTimeRange";
import { useRealtimeEvent } from "../../context/RealtimeContext";

type RoomPanelProps = {
  roomId: string;
  roomLabel: string;
};

const BRIGHTNESS_DEBOUNCE_MS = 400;
const FAN_OPTIONS = ["low", "mid", "high", "auto"];

function deviceIcon(type: Device["type"]) {
  switch (type) {
    case "light": return "💡";
    case "ac": return "❄️";
    case "blinds": return "🪟";
    default: return "🔌";
  }
}

export default function RoomPanel({ roomId, roomLabel }: RoomPanelProps) {
  const [roomTasks, setRoomTasks] = useState<UITask[]>([]);
  const [roomDevices, setRoomDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const brightnessTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [roomScenes, setRoomScenes] = useState<Scene[]>([]);
  const sceneTrigger = useSceneTrigger();
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskCategory, setAddTaskCategory] = useState("misc");
  const [showAddTask, setShowAddTask] = useState(false);
  const savedScrollRef = useRef({ y: 0, x: 0 });

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const list = await devicesService.fetchDevices(roomId);
      setRoomDevices(list);
    } catch {
      setRoomDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadDevices();
    return () => {
      Object.values(brightnessTimeoutRef.current).forEach(clearTimeout);
      brightnessTimeoutRef.current = {};
    };
  }, [loadDevices]);

  useRealtimeEvent("devices_updated", loadDevices);

  useEffect(() => {
    scenesService.fetchScenes().then((all) => {
      setRoomScenes(getRoomScenes(all, roomId));
    }).catch(() => setRoomScenes([]));
  }, [roomId]);

  async function sendCommand(deviceId: string, command: devicesService.DeviceCommand) {
    const prev = roomDevices;
    setUpdatingId(deviceId);
    try {
      const updated = await devicesService.setDeviceState(deviceId, command);
      setRoomDevices((d) => d.map((x) => (x.id === deviceId ? updated : x)));
    } catch {
      setRoomDevices(prev);
    } finally {
      setUpdatingId(null);
    }
  }

  function setOptimistic(deviceId: string, patch: Partial<Device>) {
    setRoomDevices((d) => d.map((x) => (x.id === deviceId ? { ...x, ...patch } : x)));
  }

  async function handleSwitch(device: Device, on: boolean) {
    setOptimistic(device.id, { powerState: on });
    await sendCommand(device.id, { switch: on });
  }

  function handleBrightness(device: Device, pct: number) {
    const bright = Math.max(1, Math.min(255, Math.round((pct / 100) * 255)));
    setOptimistic(device.id, { brightness: bright });
    if (brightnessTimeoutRef.current[device.id]) clearTimeout(brightnessTimeoutRef.current[device.id]);
    brightnessTimeoutRef.current[device.id] = setTimeout(async () => {
      try {
        const updated = await devicesService.setDeviceState(device.id, { brightness: bright });
        setRoomDevices((d) => d.map((x) => (x.id === device.id ? updated : x)));
      } catch {
        loadDevices();
      }
      delete brightnessTimeoutRef.current[device.id];
    }, BRIGHTNESS_DEBOUNCE_MS);
  }

  async function handleTemp(device: Device, delta: number) {
    const current = device.temperature ?? 24;
    const next = Math.max(16, Math.min(30, current + delta));
    setOptimistic(device.id, { temperature: next });
    await sendCommand(device.id, { temperature: next });
  }

  async function handleFan(device: Device, fanSpeed: string) {
    setOptimistic(device.id, { fanSpeed });
    await sendCommand(device.id, { fanSpeed });
  }

  async function handleBlinds(device: Device, open: boolean) {
    setOptimistic(device.id, { blindsPosition: open ? 100 : 0 });
    await sendCommand(device.id, { blindsOpen: open });
  }

  const loadTasks = useCallback(async () => {
    if (!getSupabaseClient()) {
      setRoomTasks([]);
      return;
    }
    try {
      const rows = await tasksService.fetchTasks();
      const ui = taskRowsToUI(rows);
      const pending = ui.filter((t) => t.status !== "completed" && t.room === roomId);
      setRoomTasks(pending);
    } catch {
      setRoomTasks([]);
    }
  }, [roomId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useRealtimeTable("tasks", loadTasks);

  async function handleAddTask() {
    const t = addTaskTitle.trim();
    if (!t || !getSupabaseClient()) return;
    if (typeof window !== "undefined") {
      savedScrollRef.current = { y: window.scrollY, x: window.scrollX };
    }
    try {
      const start = new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await tasksService.createTask({
        title: t,
        assigned_by: roomLabel,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration: 60,
        room: roomId,
      });
      setAddTaskTitle("");
      setShowAddTask(false);
      await loadTasks();
    } catch {
      // keep form state
    }
    requestAnimationFrame(() => {
      if (typeof window !== "undefined") {
        window.scrollTo(savedScrollRef.current.x, savedScrollRef.current.y);
      }
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
  }

  async function handleComplete(task: UITask) {
    if (!getSupabaseClient()) return;
    try {
      await tasksService.completeTask(task.id);
      await loadTasks();
    } catch {
      // ignore
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col max-w-[1024px] mx-auto w-full px-6 py-5">
      <section className="flex-[3] min-h-0 flex flex-col mb-6">
        <h2 className="text-xl font-semibold text-white/90 mb-4 shrink-0">Room Devices</h2>
        {devicesLoading ? (
          <p className="text-[0.8125rem] text-white/45">Loading devices…</p>
        ) : roomDevices.length === 0 ? (
          <p className="text-[0.8125rem] text-white/45">No devices in this room. Map devices via TUYA_DEVICE_ROOMS.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 min-h-0 content-start">
            {roomDevices.map((d) => {
              const updating = updatingId === d.id;
              const online = d.isOnline !== false;
              const isOn = d.powerState === true;
              const brightnessPct = d.brightness != null ? Math.round((d.brightness / 255) * 100) : 50;
              return (
                <div
                  key={d.id}
                  className="rounded-2xl bg-slate-800/50 p-4 backdrop-blur-md border border-white/[0.06] flex flex-col gap-3 min-h-[120px]"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    {updating ? (
                      <span className="w-6 h-6 border border-white/50 border-t-transparent rounded-full animate-spin" aria-hidden />
                    ) : (
                      <span className="text-2xl" aria-hidden>{deviceIcon(d.type)}</span>
                    )}
                    <span className="text-[0.875rem] font-medium text-white/90 truncate">{d.name}</span>
                  </div>
                  {/* Light: ON/OFF + brightness */}
                  {(d.type === "light" || (d.type === "switch" && d.brightness != null)) && (
                    <>
                      <button
                        type="button"
                        disabled={!online || updating}
                        onClick={() => handleSwitch(d, !isOn)}
                        className={`w-full rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${isOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/90 hover:bg-white/15"}`}
                      >
                        {isOn ? "On" : "Off"}
                      </button>
                      {online && (
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6875rem] text-white/45">Dim</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={brightnessPct}
                            disabled={!isOn}
                            onChange={(e) => handleBrightness(d, Number(e.target.value))}
                            className="flex-1 h-1.5 rounded-full appearance-none bg-white/15 accent-emerald-400"
                          />
                          <span className="text-[0.6875rem] text-white/45">Bright</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* AC: ON/OFF + temp + fan */}
                  {d.type === "ac" && (
                    <>
                      <button
                        type="button"
                        disabled={!online || updating}
                        onClick={() => handleSwitch(d, !isOn)}
                        className={`w-full rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${isOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/90 hover:bg-white/15"}`}
                      >
                        {isOn ? "On" : "Off"}
                      </button>
                      {online && (
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" disabled={updating} onClick={() => handleTemp(d, -1)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white/90 text-sm font-medium">−</button>
                          <span className="text-[0.875rem] text-white/90 tabular-nums">{d.temperature ?? "—"}°</span>
                          <button type="button" disabled={updating} onClick={() => handleTemp(d, 1)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white/90 text-sm font-medium">+</button>
                        </div>
                      )}
                      {online && (
                        <div className="flex flex-wrap gap-1">
                          {FAN_OPTIONS.map((f) => (
                            <button
                              key={f}
                              type="button"
                              disabled={updating}
                              onClick={() => handleFan(d, f)}
                              className={`rounded-lg px-2 py-1 text-[0.6875rem] font-medium capitalize ${String(d.fanSpeed) === f ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/80"}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {/* Blinds: OPEN / CLOSE */}
                  {d.type === "blinds" && (
                    <div className="flex gap-2 mt-auto">
                      <button
                        type="button"
                        disabled={!online || updating}
                        onClick={() => handleBlinds(d, true)}
                        className={`flex-1 rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${d.blindsPosition === 100 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/90 hover:bg-white/15"}`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        disabled={!online || updating}
                        onClick={() => handleBlinds(d, false)}
                        className={`flex-1 rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${d.blindsPosition === 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/90 hover:bg-white/15"}`}
                      >
                        Close
                      </button>
                    </div>
                  )}
                  {/* Switch only */}
                  {d.type === "switch" && d.brightness == null && d.temperature == null && d.blindsPosition == null && (
                    <button
                      type="button"
                      disabled={!online || updating}
                      onClick={() => handleSwitch(d, !isOn)}
                      className={`w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 mt-auto ${isOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/90 hover:bg-white/15"}`}
                    >
                      {isOn ? "On" : "Off"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {roomScenes.length > 0 && (
        <section className="shrink-0 mb-6">
          <h2 className="text-xl font-semibold text-white/90 mb-4">Room Scenes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {roomScenes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => sceneTrigger?.triggerScene(s.id)}
                disabled={sceneTrigger?.activatingId != null}
                className={`rounded-2xl bg-slate-800/50 p-4 backdrop-blur-md border flex flex-col items-center gap-2 hover:bg-slate-800/70 transition disabled:opacity-60 ${
                  sceneTrigger?.activeScene === s.id
                    ? "border-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
                    : "border-white/[0.06]"
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm font-medium text-white/90">{s.name}</span>
                {s.description && (
                  <span className="text-[0.6875rem] text-white/50 text-center truncate w-full">{s.description}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex-[1] min-h-0 flex flex-col rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-xl font-semibold text-white/90">Room Tasks</h2>
          <button
            type="button"
            onClick={() => setShowAddTask(!showAddTask)}
            disabled={!getSupabaseClient()}
            className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-medium text-white/90 transition disabled:opacity-50"
          >
            + Add Task
          </button>
        </div>
        {showAddTask && (
          <div className="flex flex-wrap gap-2 mb-3 p-3 rounded-xl bg-slate-800/50">
            <input
              type="text"
              placeholder="Task title"
              value={addTaskTitle}
              onChange={(e) => setAddTaskTitle(e.target.value)}
              className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            />
            <select
              value={addTaskCategory}
              onChange={(e) => setAddTaskCategory(e.target.value)}
              className="rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddTask}
              disabled={!addTaskTitle.trim() || !getSupabaseClient()}
              className="rounded-xl bg-slate-600/80 px-4 py-2.5 text-sm font-medium text-white/90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
        <ul className="space-y-2 min-h-0 overflow-auto">
          {roomTasks.length === 0 ? (
            <li className="text-[0.8125rem] text-white/45">No tasks for this room.</li>
          ) : (
            roomTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl bg-slate-800/40 px-3.5 py-2.5 border border-white/[0.04]"
              >
                <span className="text-base shrink-0">{getCategoryIcon(t.category ?? "misc")}</span>
                <div className="min-w-0 flex-1">
                  {(t.startTime || t.endTime) && (
                    <p className="text-[0.6875rem] text-white/50 tabular-nums">
                      {formatTaskTimeRange(
                        t.startTime ?? "",
                        t.endTime ?? new Date(new Date(t.startTime!).getTime() + (t.durationMinutes ?? 60) * 60000).toISOString(),
                        t.durationMinutes
                      )}
                    </p>
                  )}
                  <span className="text-[0.875rem] text-white/90 truncate block">{t.title}</span>
                  {(t.urgent || t.assignedBy) && (
                    <span className="text-[0.6875rem] text-white/50">
                      {t.urgent ? "Urgent · " : ""}{t.assignedBy || "Abdullah"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleComplete(t)}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-[0.75rem] font-medium text-white/80 hover:bg-white/15"
                >
                  Done
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
