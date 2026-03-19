/**
 * Room options for task assignment and panel filtering.
 * Values must match room panel identifiers (e.g. for task.room === roomPanelName).
 */

export const ROOM_OPTIONS = [
  { value: "kitchen", label: "Kitchen" },
  { value: "winklevi_room", label: "Winklevi Room" },
  { value: "mariam_room", label: "Mariam Room" },
  { value: "master_bedroom", label: "Master Bedroom" },
  { value: "dining_room", label: "Dining Room" },
  { value: "living_room", label: "Living Room" },
] as const;

export type RoomValue = (typeof ROOM_OPTIONS)[number]["value"];

export function getRoomLabel(room: string): string {
  return ROOM_OPTIONS.find((r) => r.value === room)?.label ?? room;
}
