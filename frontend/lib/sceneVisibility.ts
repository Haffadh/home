/**
 * Scene visibility rules — determines which scenes a role can see.
 */

import type { Role } from "./roles";
import { USER_DEFAULT_ROOM, ROLE_LABELS } from "./roles";
import type { Scene } from "./services/scenes";

const ROOM_ROLE_TO_NAME: Record<string, string> = {
  winklevi_room: "Winklevi Room",
  mariam_room: "Mariam Room",
  master_bedroom: "Master Bedroom",
  kitchen: "Kitchen",
  living_room: "Living Room",
  dining_room: "Dining Room",
};

/**
 * Filter scenes visible to a given role.
 * - abdullah / admin: ALL scenes
 * - Room roles (e.g. winklevi_room): house-wide + that room's scenes
 * - Family members (moeen, samya, etc.): house-wide + their default room
 */
export function getVisibleScenes(scenes: Scene[], role: Role | null): Scene[] {
  if (!role) return [];

  // Abdullah and admin see everything
  if (role === "abdullah" || role === "admin") return scenes;

  // Room roles: house-wide + that room
  if (ROOM_ROLE_TO_NAME[role]) {
    const roomName = ROOM_ROLE_TO_NAME[role];
    return scenes.filter(
      (s) => s.scope === "house" || (s.scope === "room" && s.room === roomName)
    );
  }

  // Family members: house-wide + their default room
  const userRoom = USER_DEFAULT_ROOM[role];
  if (userRoom) {
    return scenes.filter(
      (s) => s.scope === "house" || (s.scope === "room" && s.room === userRoom)
    );
  }

  // Fallback: house-wide only
  return scenes.filter((s) => s.scope === "house");
}

/**
 * Filter to only room-scoped scenes for a specific room panel.
 * roomId is the role-style ID (e.g. "winklevi_room") — mapped to display name.
 */
export function getRoomScenes(scenes: Scene[], roomId: string): Scene[] {
  const roomName = ROOM_ROLE_TO_NAME[roomId] || ROLE_LABELS[roomId as Role] || roomId;
  return scenes.filter((s) => s.scope === "room" && s.room === roomName);
}
