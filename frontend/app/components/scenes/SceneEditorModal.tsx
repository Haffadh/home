"use client";

import { useEffect, useState } from "react";
import type {
  Scene,
  SceneAction,
  DeviceCommandAction,
  TaskCreateAction,
  MusicModeAction,
} from "../../../lib/services/scenes";
import type { Device } from "../../../lib/services/devices";

/* ── Constants ────────────────────────────────────────────────────────────── */

const ICON_OPTIONS = ["✨", "🌙", "🚪", "🎬", "🚿", "💡", "❄️", "🪟", "🍷", "🏠", "☀️", "🎵"];
const FAN_SPEEDS = ["low", "mid", "high", "auto"] as const;
const SCENE_ROOMS = [
  "Kitchen",
  "Living Room",
  "Dining Room",
  "Master Bedroom",
  "Winklevi Room",
  "Mariam Room",
] as const;

const MUSIC_GENRES = [
  "Quran",
  "Arabic",
  "Jazz",
  "Classical",
  "Chill",
  "Pop",
  "Lo-fi",
  "Ambient",
] as const;

const TIME_WINDOWS = [
  { value: "morning", label: "Morning", desc: "8 AM - 12 PM" },
  { value: "afternoon", label: "Afternoon", desc: "12 PM - 5 PM" },
  { value: "evening", label: "Evening", desc: "5 PM - 10 PM" },
] as const;

const ACTION_LABELS: Record<string, string> = {
  device_command: "Device Command",
  task_create: "Create Task",
  music_mode: "Music",
  notification: "Notification",
};

type DeviceCommandKind = "switch" | "brightness" | "temperature" | "fanSpeed" | "blindsOpen";

type Props = {
  scene: Scene | null;
  devices: Device[];
  onClose: () => void;
  onSave: (payload: {
    name: string;
    icon: string;
    description: string;
    actions: SceneAction[];
    schedule: null;
    scope: "room" | "house";
    room: string | null;
  }) => Promise<void>;
  defaultRoom?: string | null;
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function defaultAction(type: "device_command" | "task_create" | "music_mode"): SceneAction {
  if (type === "device_command") {
    return { type: "device_command", deviceId: "", command: { switch: false } };
  }
  if (type === "task_create") {
    return { type: "task_create", title: "", priority: "normal", time_window: "morning" };
  }
  return { type: "music_mode", mode: "play", genre: "Quran", volume: 40 };
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function SceneEditorModal({ scene, devices, onClose, onSave, defaultRoom }: Props) {
  const isEdit = scene != null;

  const [scope, setScope] = useState<"room" | "house">(scene?.scope ?? "room");
  const [room, setRoom] = useState<string | null>(scene?.room ?? defaultRoom ?? SCENE_ROOMS[0]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✨");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState<SceneAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHouseConfirm, setShowHouseConfirm] = useState(false);

  useEffect(() => {
    if (scene) {
      setScope(scene.scope ?? "house");
      setRoom(scene.room ?? null);
      setName(scene.name);
      setIcon(scene.icon || "✨");
      setDescription(scene.description || "");
      setActions(scene.actions?.length ? [...scene.actions] : []);
    } else {
      setScope("room");
      setRoom(defaultRoom ?? SCENE_ROOMS[0]);
      setName("");
      setIcon("✨");
      setDescription("");
      setActions([]);
    }
  }, [scene, defaultRoom]);

  const filteredDevices =
    scope === "room" && room
      ? devices.filter((d) => d.room === room)
      : devices;

  async function doSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Name is required"); return; }
    if (scope === "room" && !room) { setError("Please select a room"); return; }
    setError("");
    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        icon: icon || "✨",
        description: description.trim(),
        actions,
        schedule: null,
        scope,
        room: scope === "room" ? room : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "house" && !isEdit) { setShowHouseConfirm(true); return; }
    await doSave();
  }

  function addAction(type: "device_command" | "task_create" | "music_mode") {
    setActions((prev) => [...prev, defaultAction(type)]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function replaceAction(index: number, action: SceneAction) {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-editor-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0f172a] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 id="scene-editor-title" className="text-xl font-semibold text-white/95">
              {isEdit ? "Edit Scene" : "New Scene"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/60 hover:text-white/90 hover:bg-white/10 transition"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && (
            <p className="text-sm text-rose-300/90 rounded-xl bg-rose-500/10 px-3 py-2 border border-rose-400/20">
              {error}
            </p>
          )}

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Scope</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setScope("room"); if (!room) setRoom(SCENE_ROOMS[0]); }}
                className={`rounded-xl py-3 text-sm font-medium transition border ${
                  scope === "room"
                    ? "bg-amber-500/15 border-amber-400/30 text-amber-200"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="text-lg block mb-1">🚪</span>
                Room Scene
              </button>
              <button
                type="button"
                onClick={() => setScope("house")}
                className={`rounded-xl py-3 text-sm font-medium transition border ${
                  scope === "house"
                    ? "bg-blue-500/15 border-blue-400/30 text-blue-200"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="text-lg block mb-1">🏠</span>
                House-wide
              </button>
            </div>
          </div>

          {/* Room */}
          {scope === "room" && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Room</label>
              <select
                value={room || ""}
                onChange={(e) => setRoom(e.target.value || null)}
                className="w-full rounded-xl px-4 py-2.5 text-white/95 bg-slate-800/80 border border-white/10 focus:border-white/20 focus:outline-none"
              >
                {SCENE_ROOMS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {/* Name + Icon row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-white/95 bg-slate-800/80 border border-white/10 focus:border-white/20 focus:outline-none"
                placeholder="e.g. Bedtime"
              />
            </div>
            <div className="shrink-0">
              <label className="block text-sm font-medium text-white/70 mb-1">Icon</label>
              <div className="flex gap-1.5 flex-wrap max-w-[8rem]">
                {ICON_OPTIONS.slice(0, 6).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                      icon === emoji ? "bg-white/20 ring-1 ring-white/30" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
                {ICON_OPTIONS.slice(6).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                      icon === emoji ? "bg-white/20 ring-1 ring-white/30" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-white/95 bg-slate-800/80 border border-white/10 focus:border-white/20 focus:outline-none"
              placeholder="Optional description"
            />
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-white/70">Actions</label>
              <div className="flex gap-2">
                {(["device_command", "task_create", "music_mode"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addAction(t)}
                    className="text-[0.75rem] rounded-lg px-2.5 py-1.5 bg-white/10 text-white/80 hover:bg-white/15 transition"
                  >
                    + {t === "device_command" ? "Device" : t === "task_create" ? "Task" : "Music"}
                  </button>
                ))}
              </div>
            </div>

            {actions.length === 0 && (
              <p className="text-[0.8125rem] text-white/40 text-center py-4 rounded-xl border border-dashed border-white/10">
                No actions yet. Add a device, task, or music action above.
              </p>
            )}

            <ul className="space-y-3">
              {actions.map((action, index) => (
                <li
                  key={index}
                  className="rounded-xl bg-slate-800/50 border border-white/10 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.75rem] font-medium text-white/60">
                      {ACTION_LABELS[action.type] ?? action.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="text-[0.75rem] text-white/40 hover:text-rose-300 transition"
                    >
                      Remove
                    </button>
                  </div>

                  {action.type === "device_command" && (
                    <DeviceCommandEditor
                      action={action}
                      devices={filteredDevices}
                      onChange={(a) => replaceAction(index, a)}
                    />
                  )}
                  {action.type === "task_create" && (
                    <TaskCreateEditor
                      action={action}
                      onChange={(a) => replaceAction(index, a)}
                    />
                  )}
                  {action.type === "music_mode" && (
                    <MusicEditor
                      action={action}
                      onChange={(a) => replaceAction(index, a)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Schedule — disabled */}
          <div className="rounded-xl bg-slate-800/30 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/70">Schedule</label>
              <div className="flex items-center gap-2">
                <span className="text-[0.6875rem] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
                <div className="relative w-10 h-6 rounded-full bg-white/10 opacity-50 cursor-not-allowed">
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/15 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>

        {/* House-wide confirmation */}
        {showHouseConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-3xl">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 text-center space-y-4">
              <p className="text-lg text-white/90">Create house-wide scene?</p>
              <p className="text-sm text-white/60">
                This scene will affect all rooms and be visible to everyone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowHouseConfirm(false)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/15 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHouseConfirm(false); doSave(); }}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Device Command Editor ───────────────────────────────────────────────── */

function DeviceCommandEditor({
  action,
  devices,
  onChange,
}: {
  action: DeviceCommandAction;
  devices: Device[];
  onChange: (action: DeviceCommandAction) => void;
}) {
  const cmd = action.command || {};
  const inferKind = (): DeviceCommandKind => {
    if (cmd.brightness !== undefined) return "brightness";
    if (cmd.temperature !== undefined) return "temperature";
    if (cmd.fanSpeed !== undefined) return "fanSpeed";
    if (cmd.blindsOpen !== undefined) return "blindsOpen";
    return "switch";
  };
  const [kind, setKind] = useState<DeviceCommandKind>(() => inferKind());
  const deviceId = action.deviceId ?? "";

  function apply(k: DeviceCommandKind, value: unknown, did?: string) {
    const base: DeviceCommandAction["command"] = {};
    if (k === "switch") base.switch = value as boolean;
    if (k === "brightness") base.brightness = value as number;
    if (k === "temperature") base.temperature = value as number;
    if (k === "fanSpeed") base.fanSpeed = value as string;
    if (k === "blindsOpen") base.blindsOpen = value as boolean;
    onChange({ type: "device_command", deviceId: did ?? deviceId, command: base });
  }

  return (
    <div className="space-y-2.5">
      <select
        value={deviceId}
        onChange={(e) => onChange({ ...action, deviceId: e.target.value || undefined })}
        className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
      >
        <option value="">Select device</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}{d.room ? ` (${d.room})` : ""}
          </option>
        ))}
      </select>

      <select
        value={kind}
        onChange={(e) => {
          const k = e.target.value as DeviceCommandKind;
          setKind(k);
          const defaults: Record<DeviceCommandKind, unknown> = {
            switch: true, brightness: 128, temperature: 24, fanSpeed: "mid", blindsOpen: true,
          };
          apply(k, defaults[k]);
        }}
        className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
      >
        <option value="switch">Power On / Off</option>
        <option value="brightness">Brightness</option>
        <option value="temperature">Temperature</option>
        <option value="fanSpeed">Fan Speed</option>
        <option value="blindsOpen">Blinds</option>
      </select>

      {kind === "switch" && (
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => apply("switch", v)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                cmd.switch === v ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {v ? "On" : "Off"}
            </button>
          ))}
        </div>
      )}
      {kind === "brightness" && (
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm">💡</span>
          <input type="range" min={0} max={100}
            value={typeof cmd.brightness === "number" ? Math.round((cmd.brightness / 255) * 100) : 50}
            onChange={(e) => apply("brightness", Math.round((Number(e.target.value) / 100) * 255) || 1)}
            className="flex-1 h-2 rounded-full accent-emerald-500"
          />
          <span className="text-[0.8125rem] text-white/60 w-10 text-right">
            {typeof cmd.brightness === "number" ? Math.round((cmd.brightness / 255) * 100) : 50}%
          </span>
        </div>
      )}
      {kind === "temperature" && (
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm">❄️</span>
          <input type="range" min={16} max={30}
            value={cmd.temperature ?? 24}
            onChange={(e) => apply("temperature", Number(e.target.value))}
            className="flex-1 h-2 rounded-full accent-blue-400"
          />
          <span className="text-[0.8125rem] text-white/60 w-10 text-right">{cmd.temperature ?? 24}°C</span>
        </div>
      )}
      {kind === "fanSpeed" && (
        <div className="grid grid-cols-4 gap-1.5">
          {FAN_SPEEDS.map((f) => (
            <button key={f} type="button" onClick={() => apply("fanSpeed", f)}
              className={`rounded-lg py-2 text-[0.75rem] font-medium capitalize transition ${
                cmd.fanSpeed === f ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {kind === "blindsOpen" && (
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => apply("blindsOpen", v)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                cmd.blindsOpen === v ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {v ? "Open" : "Close"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Task Create Editor ──────────────────────────────────────────────────── */

function TaskCreateEditor({
  action,
  onChange,
}: {
  action: TaskCreateAction;
  onChange: (action: TaskCreateAction) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Title */}
      <input
        type="text"
        value={action.title}
        onChange={(e) => onChange({ ...action, title: e.target.value })}
        placeholder="What needs to be done?"
        className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
      />

      {/* Priority */}
      <div>
        <label className="block text-[0.6875rem] text-white/50 mb-1.5">Priority</label>
        <div className="grid grid-cols-2 gap-2">
          {(["normal", "urgent"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ ...action, priority: p })}
              className={`rounded-lg py-2 text-[0.8125rem] font-medium capitalize transition ${
                (action.priority ?? "normal") === p
                  ? p === "urgent"
                    ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Time window */}
      <div>
        <label className="block text-[0.6875rem] text-white/50 mb-1.5">Time Window</label>
        <div className="grid grid-cols-3 gap-2">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.value}
              type="button"
              onClick={() => onChange({ ...action, time_window: tw.value })}
              className={`rounded-lg py-2 text-center transition ${
                (action.time_window ?? "morning") === tw.value
                  ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <span className="text-[0.8125rem] font-medium block">{tw.label}</span>
              <span className="text-[0.625rem] text-white/40">{tw.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Music Editor ────────────────────────────────────────────────────────── */

function MusicEditor({
  action,
  onChange,
}: {
  action: MusicModeAction;
  onChange: (action: MusicModeAction) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Mode */}
      <div>
        <label className="block text-[0.6875rem] text-white/50 mb-1.5">Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {(["play", "pause", "stop"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...action, mode: m })}
              className={`rounded-lg py-2 text-[0.8125rem] font-medium capitalize transition ${
                action.mode === m
                  ? m === "stop"
                    ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {m === "play" ? "▶ Play" : m === "pause" ? "⏸ Pause" : "⏹ Stop"}
            </button>
          ))}
        </div>
      </div>

      {/* Genre (only when playing) */}
      {action.mode === "play" && (
        <div>
          <label className="block text-[0.6875rem] text-white/50 mb-1.5">Genre</label>
          <div className="flex flex-wrap gap-1.5">
            {MUSIC_GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onChange({ ...action, genre: g })}
                className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition ${
                  (action.genre ?? "Quran") === g
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Volume (play or pause) */}
      {action.mode !== "stop" && (
        <div>
          <label className="block text-[0.6875rem] text-white/50 mb-1.5">Volume</label>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-sm">🔈</span>
            <input
              type="range"
              min={0}
              max={100}
              value={action.volume ?? 40}
              onChange={(e) => onChange({ ...action, volume: Number(e.target.value) })}
              className="flex-1 h-2 rounded-full accent-violet-500"
            />
            <span className="text-[0.8125rem] text-white/60 w-10 text-right">{action.volume ?? 40}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
