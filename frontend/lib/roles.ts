export type Role =
  | "moeen"
  | "samya"
  | "nawaf"
  | "ahmed"
  | "mariam"
  | "abdullah"
  | "kitchen"
  | "living_room"
  | "dining_room"
  | "master_bedroom"
  | "winklevi_room"
  | "mariam_room"
  | "admin";

/** User roles — real family members */
export const USER_ROLES: Role[] = [
  "moeen",
  "samya",
  "nawaf",
  "ahmed",
  "mariam",
  "abdullah",
];

/** Room roles — device panels */
export const ROOM_ROLES: Role[] = [
  "kitchen",
  "living_room",
  "dining_room",
  "master_bedroom",
  "winklevi_room",
  "mariam_room",
];

export const ROLE_LABELS: Record<Role, string> = {
  moeen: "Moeen",
  samya: "Samya",
  nawaf: "Nawaf",
  ahmed: "Ahmed",
  mariam: "Mariam",
  abdullah: "Abdullah",
  kitchen: "Kitchen",
  living_room: "Living Room",
  dining_room: "Dining Room",
  master_bedroom: "Master Bedroom",
  winklevi_room: "Winklevi Room",
  mariam_room: "Mariam Room",
  admin: "Admin",
};

/** Display name for login buttons */
export const LOGIN_LABELS: Record<Role, string> = {
  moeen: "Moeen#1",
  samya: "Samya#1",
  nawaf: "Nawaf#1",
  ahmed: "Ahmed#1",
  mariam: "Mariam#1",
  abdullah: "Abdullah#1",
  kitchen: "Kitchen#1",
  living_room: "Living#1",
  dining_room: "Dining#1",
  master_bedroom: "Master#1",
  winklevi_room: "Winklevi#1",
  mariam_room: "Mariam#1",
  admin: "Admin",
};

/** Human name for the actor (used in tasks, meals, etc.) */
export const ACTOR_NAME: Record<Role, string> = {
  moeen: "Baba",
  samya: "Mama",
  nawaf: "Nawaf",
  ahmed: "Ahmed",
  mariam: "Mariam",
  abdullah: "Abdullah",
  kitchen: "Kitchen",
  living_room: "Living Room",
  dining_room: "Dining Room",
  master_bedroom: "Master Bedroom",
  winklevi_room: "Winklevi Room",
  mariam_room: "Mariam Room",
  admin: "Admin",
};

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  moeen: "/panel/house",
  samya: "/panel/house",
  nawaf: "/panel/house",
  ahmed: "/panel/house",
  mariam: "/panel/house",
  abdullah: "/panel/abdullah",
  kitchen: "/panel/kitchen",
  living_room: "/panel/living_room",
  dining_room: "/panel/dining_room",
  master_bedroom: "/panel/master_bedroom",
  winklevi_room: "/panel/winklevi_room",
  mariam_room: "/panel/mariam_room",
  admin: "/panel/admin",
};

export const STORAGE_KEY = "shh_role";

const VALID_ROLES: Role[] = [...USER_ROLES, ...ROOM_ROLES, "admin"];

/** Kept for backward compat — all non-admin roles */
export const VISIBLE_ROLES = VALID_ROLES.filter((r) => r !== "admin");

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && VALID_ROLES.includes(v as Role)) return v as Role;
  // Backward compat: "house" → first user role
  if (v === "house") return "moeen";
  return null;
}
