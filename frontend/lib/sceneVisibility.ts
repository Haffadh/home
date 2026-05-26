/**
 * Scene visibility rules — determines which scenes a role can see.
 */

import type { Role } from "./roles";
import { USER_DEFAULT_ROOM } from "./roles";
import type { Scene } from "./services/scenes";

/**
 * Filter scenes visible to a given role.
 * - abdullah / admin / kitchen: ALL scenes
 * - Family members: house-wide + their default room
 */
export function getVisibleScenes(scenes: Scene[], role: Role | null): Scene[] {
  if (!role) return [];

  if (role === "abdullah" || role === "admin" || role === "kitchen") return scenes;

  const userRoom = USER_DEFAULT_ROOM[role];
  if (userRoom) {
    return scenes.filter(
      (s) => s.scope === "house" || (s.scope === "room" && s.room === userRoom)
    );
  }

  return scenes.filter((s) => s.scope === "house");
}
