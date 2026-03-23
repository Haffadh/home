"use client";

import { useEffect, useState } from "react";
import type {
  Scene,
  SceneAction,
  DeviceCommandAction,
  MusicModeAction,
} from "../../../lib/services/scenes";
import type { Device } from "../../../lib/services/devices";

const ICON_OPTIONS = ["✨", "🌙", "🚪", "🎬", "🚿", "💡", "❄️", "🪟", "🍷", "🏠", "☀️"];
const MUSIC_MODES = ["on", "off", "stop"] as const;
const FAN_SPEEDS = ["low", "mid", "high", "auto"] as const;
const SCENE_ROOMS = [
  "Kitchen",
  "Living Room",
  "Dining Room",
  "Master Bedroom",
  "Winklevi Room",
  "Mariam Room",
] as const;

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

function defaultAction(type: "device_command" | "task_create" | "music_mode"): SceneAction {
  if (type === "device_command") {
    return { type: "device_command", deviceId: "", command: { switch: false } };
  }
  if (type === "task_create") {
    return { type: "task_create", title: "" };
  }
  return { type: "music_mode", mode: "stop" };
}

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

  // Filter devices by room when scope is room
  const filteredDevices =
    scope === "room" && room
      ? devices.filter((d) => d.room === room)
      : devices;

  async function doSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (scope === "room" && !room) {
      setError("Please select a room");
      return;
    }
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
    // Show confirmation for new house-wide scenes
    if (scope === "house" && !isEdit) {
      setShowHouseConfirm(true);
      return;
    }
    await doSave();
  }

  function addAction(type: "device_command" | "task_create" | "music_mode") {
    setActions((prev) => [...prev, defaultAction(type)]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAction(index: number, patch: Partial<SceneAction>) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } as SceneAction : a))
    );
  }

  function updateDeviceCommand(index: number, deviceId: string, command: DeviceCommandAction["command"]) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === index && a.type === "device_command"
          ? { ...a, deviceId: deviceId || undefined, command }
          : a
      )
    );
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* Scope selector */}
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

          {/* Room selection (only for room scope) */}
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-white/95 bg-slate-800/80 border border-white/10 focus:border-white/20 focus:outline-none"
              placeholder="e.g. Bedtime"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${
                    icon === emoji ? "bg-white/20 ring-1 ring-white/30" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2) || "✨")}
                className="w-14 rounded-xl px-2 py-2 text-center text-lg bg-slate-800/80 border border-white/10"
                placeholder="✨"
              />
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white/70">Actions</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addAction("device_command")}
                  className="text-[0.75rem] rounded-lg px-2.5 py-1.5 bg-white/10 text-white/80 hover:bg-white/15"
                >
                  + Device
                </button>
                <button
                  type="button"
                  onClick={() => addAction("task_create")}
                  className="text-[0.75rem] rounded-lg px-2.5 py-1.5 bg-white/10 text-white/80 hover:bg-white/15"
                >
                  + Task
                </button>
                <button
                  type="button"
                  onClick={() => addAction("music_mode")}
                  className="text-[0.75rem] rounded-lg px-2.5 py-1.5 bg-white/10 text-white/80 hover:bg-white/15"
                >
                  + Music
                </button>
              </div>
            </div>
            <ul className="space-y-3">
              {actions.map((action, index) => (
                <li
                  key={index}
                  className="rounded-xl bg-slate-800/50 border border-white/10 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.75rem] text-white/50 uppercase tracking-wide">
                      {action.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="text-white/50 hover:text-rose-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  {action.type === "device_command" && (
                    <DeviceCommandEditor
                      action={action}
                      devices={filteredDevices}
                      onChange={(deviceId, command) => updateDeviceCommand(index, deviceId, command)}
                    />
                  )}
                  {action.type === "task_create" && (
                    <input
                      type="text"
                      value={action.title}
                      onChange={(e) => updateAction(index, { title: e.target.value })}
                      placeholder="Task title"
                      className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
                    />
                  )}
                  {action.type === "music_mode" && (
                    <select
                      value={action.mode}
                      onChange={(e) => updateAction(index, { mode: e.target.value as MusicModeAction["mode"] })}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
                    >
                      {MUSIC_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Schedule — disabled with Coming Soon */}
          <div className="rounded-xl bg-slate-800/30 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white/70">Schedule</label>
              <div className="flex items-center gap-2">
                <span className="text-[0.6875rem] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={false}
                  disabled
                  className="relative w-10 h-6 rounded-full bg-white/10 opacity-50 cursor-not-allowed"
                >
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
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

        {/* House-wide confirmation overlay */}
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
                  onClick={() => {
                    setShowHouseConfirm(false);
                    doSave();
                  }}
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

function DeviceCommandEditor({
  action,
  devices,
  onChange,
}: {
  action: DeviceCommandAction;
  devices: Device[];
  onChange: (deviceId: string, command: DeviceCommandAction["command"]) => void;
}) {
  const cmd = action.command || {};
  const inferKind = (): DeviceCommandKind => {
    if (cmd.switch !== undefined) return "switch";
    if (cmd.brightness !== undefined) return "brightness";
    if (cmd.temperature !== undefined) return "temperature";
    if (cmd.fanSpeed !== undefined) return "fanSpeed";
    if (cmd.blindsOpen !== undefined) return "blindsOpen";
    return "switch";
  };
  const [kind, setKind] = useState<DeviceCommandKind>(() => inferKind());
  const deviceId = action.deviceId ?? (devices[0]?.id ?? "");

  function applyKind(k: DeviceCommandKind, value: unknown) {
    const base: DeviceCommandAction["command"] = {};
    if (k === "switch") base.switch = value as boolean;
    if (k === "brightness") base.brightness = value as number;
    if (k === "temperature") base.temperature = value as number;
    if (k === "fanSpeed") base.fanSpeed = value as string;
    if (k === "blindsOpen") base.blindsOpen = value as boolean;
    onChange(deviceId, base);
  }

  return (
    <div className="space-y-2">
      <select
        value={deviceId}
        onChange={(e) => onChange(e.target.value, cmd)}
        className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
      >
        <option value="">Select device</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} {d.room ? `(${d.room})` : ""}
          </option>
        ))}
      </select>
      <select
        value={kind}
        onChange={(e) => {
          const k = e.target.value as DeviceCommandKind;
          setKind(k);
          if (k === "switch") applyKind(k, true);
          if (k === "brightness") applyKind(k, 50);
          if (k === "temperature") applyKind(k, 24);
          if (k === "fanSpeed") applyKind(k, "mid");
          if (k === "blindsOpen") applyKind(k, true);
        }}
        className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
      >
        <option value="switch">Switch on/off</option>
        <option value="brightness">Brightness</option>
        <option value="temperature">Temperature</option>
        <option value="fanSpeed">Fan speed</option>
        <option value="blindsOpen">Blinds open/close</option>
      </select>
      {kind === "switch" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyKind("switch", true)}
            className={`flex-1 rounded-lg py-2 text-sm ${cmd.switch === true ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}
          >
            On
          </button>
          <button
            type="button"
            onClick={() => applyKind("switch", false)}
            className={`flex-1 rounded-lg py-2 text-sm ${cmd.switch === false ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}
          >
            Off
          </button>
        </div>
      )}
      {kind === "brightness" && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={typeof cmd.brightness === "number" ? Math.round((cmd.brightness / 255) * 100) : 50}
            onChange={(e) => applyKind("brightness", Math.round((Number(e.target.value) / 100) * 255) || 1)}
            className="flex-1 h-2 rounded-full accent-emerald-500"
          />
          <span className="text-[0.75rem] text-white/50 w-8">
            {typeof cmd.brightness === "number" ? Math.round((cmd.brightness / 255) * 100) : 50}%
          </span>
        </div>
      )}
      {kind === "temperature" && (
        <input
          type="number"
          min={16}
          max={30}
          value={cmd.temperature ?? 24}
          onChange={(e) => applyKind("temperature", Math.max(16, Math.min(30, Number(e.target.value))))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white/95 bg-slate-800/80 border border-white/10"
        />
      )}
      {kind === "fanSpeed" && (
        <div className="flex flex-wrap gap-1">
          {FAN_SPEEDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => applyKind("fanSpeed", f)}
              className={`rounded-lg px-2.5 py-1.5 text-[0.75rem] capitalize ${
                cmd.fanSpeed === f ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {kind === "blindsOpen" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyKind("blindsOpen", true)}
            className={`flex-1 rounded-lg py-2 text-sm ${cmd.blindsOpen === true ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => applyKind("blindsOpen", false)}
            className={`flex-1 rounded-lg py-2 text-sm ${cmd.blindsOpen === false ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
