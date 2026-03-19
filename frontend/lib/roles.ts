export type Role =
  | "house"
  | "kitchen"
  | "abdullah"
  | "winklevi_room"
  | "mariam_room"
  | "master_bedroom"
  | "dining_room"
  | "living_room"
  | "admin";

/** Roles shown on the panel selector (admin is hidden behind triple-tap + passcode) */
export const VISIBLE_ROLES: Role[] = [
  "house",
  "kitchen",
  "abdullah",
  "winklevi_room",
  "mariam_room",
  "master_bedroom",
  "dining_room",
  "living_room",
];

export const ROLE_LABELS: Record<Role, string> = {
  house: "House Member",
  kitchen: "Kitchen",
  abdullah: "Abdullah",
  winklevi_room: "Winklevi Room",
  mariam_room: "Mariam Room",
  master_bedroom: "Master Bedroom",
  dining_room: "Dining Room",
  living_room: "Living Room",
  admin: "Admin",
};

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  house: "/panel/house",
  kitchen: "/panel/kitchen",
  abdullah: "/panel/abdullah",
  winklevi_room: "/panel/winklevi_room",
  mariam_room: "/panel/mariam_room",
  master_bedroom: "/panel/master_bedroom",
  dining_room: "/panel/dining_room",
  living_room: "/panel/living_room",
  admin: "/panel/admin",
};

export const STORAGE_KEY = "shh_role";

const VALID_ROLES: Role[] = [
  "house",
  "kitchen",
  "abdullah",
  "winklevi_room",
  "mariam_room",
  "master_bedroom",
  "dining_room",
  "living_room",
  "admin",
];

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && VALID_ROLES.includes(v as Role)) return v as Role;
  return null;
}
