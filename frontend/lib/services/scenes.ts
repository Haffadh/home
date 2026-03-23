/**
 * Automation scenes: fetch, run, CRUD. Scenes run a list of actions (device_command, task_create, music_mode, notification).
 */

import { getApiBase } from "../api";

export type SceneActionType = "device_command" | "task_create" | "music_mode" | "notification";

export type DeviceCommandAction = {
  type: "device_command";
  deviceId?: string;
  command: {
    switch?: boolean;
    brightness?: number;
    temperature?: number;
    fanSpeed?: string | number;
    blindsOpen?: boolean;
  };
};

export type TaskCreateAction = {
  type: "task_create";
  title: string;
  assigned_to?: number;
};

export type MusicModeAction = {
  type: "music_mode";
  mode: "on" | "off" | "stop";
};

export type NotificationAction = {
  type: "notification";
  title?: string;
  message?: string;
};

export type SceneAction =
  | DeviceCommandAction
  | TaskCreateAction
  | MusicModeAction
  | NotificationAction;

/** Time-based schedule. Future: type "sunset" | "sunrise" | "location" with extra fields. */
export type SceneSchedule = {
  enabled: boolean;
  time: string;
  daysOfWeek: string[];
  type?: "time";
};

export type Scene = {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: SceneAction[];
  schedule: SceneSchedule | null;
  scope: "room" | "house";
  room: string | null;
  created_by: string | null;
  is_active: boolean;
};

export type SceneInsert = {
  name: string;
  icon?: string;
  description?: string;
  actions?: SceneAction[];
  schedule?: SceneSchedule | null;
  scope?: "room" | "house";
  room?: string | null;
  created_by?: string | null;
};

export type SceneUpdate = Partial<SceneInsert>;

function mapScene(d: Record<string, unknown>): Scene {
  const schedule = d.schedule;
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    icon: String(d.icon ?? "✨"),
    description: String(d.description ?? ""),
    actions: Array.isArray(d.actions) ? (d.actions as SceneAction[]) : [],
    schedule:
      schedule != null && typeof schedule === "object" && (schedule as SceneSchedule).enabled !== undefined
        ? (schedule as SceneSchedule)
        : null,
    scope: d.scope === "room" ? "room" : "house",
    room: typeof d.room === "string" ? d.room : null,
    created_by: typeof d.created_by === "string" ? d.created_by : null,
    is_active: d.is_active !== false,
  };
}

export async function fetchScenes(filters?: {
  scope?: "room" | "house";
  room?: string;
}): Promise<Scene[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.scope) params.set("scope", filters.scope);
    if (filters?.room) params.set("room", filters.room);
    const qs = params.toString();
    const path = qs ? `/api/scenes?${qs}` : "/api/scenes";

    const data = (await getApiBase(path, { cache: "no-store" }) as { ok?: boolean; scenes?: Record<string, unknown>[] });
    const list = Array.isArray(data?.scenes) ? data.scenes : [];
    return list.map(mapScene);
  } catch (e) {
    console.error("[scenes] fetchScenes", e);
    throw e;
  }
}

export async function runScene(sceneId: string): Promise<{ message: string; results?: unknown[] }> {
  try {
    const data = (await getApiBase(`/api/scenes/${encodeURIComponent(sceneId)}/run`, {
      method: "POST",
    }) as { ok?: boolean; message?: string; results?: unknown[] });
    if (!data?.ok) throw new Error("Scene run failed");
    return { message: data.message ?? `${sceneId} activated`, results: data.results };
  } catch (e) {
    console.error("[scenes] runScene", sceneId, e);
    throw e;
  }
}

export async function createScene(scene: SceneInsert): Promise<Scene> {
  const data = (await getApiBase("/api/scenes", {
    method: "POST",
    body: scene,
  }) as { ok?: boolean; scene?: Record<string, unknown> });
  if (!data?.scene) throw new Error("Create failed");
  return mapScene(data.scene);
}

export async function updateScene(sceneId: string, updates: SceneUpdate): Promise<Scene> {
  const data = (await getApiBase(`/api/scenes/${encodeURIComponent(sceneId)}`, {
    method: "PATCH",
    body: updates,
  }) as { ok?: boolean; scene?: Record<string, unknown> });
  if (!data?.scene) throw new Error("Update failed");
  return mapScene(data.scene);
}

export async function deleteScene(sceneId: string): Promise<void> {
  await getApiBase(`/api/scenes/${encodeURIComponent(sceneId)}`, {
    method: "DELETE",
  });
}
