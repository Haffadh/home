export type Role =
  | "moeen"
  | "samya"
  | "nawaf"
  | "ahmed"
  | "mariam"
  | "abdullah"
  | "kitchen"
  | "admin";

/** User roles — family members + helper */
export const USER_ROLES: Role[] = [
  "moeen",
  "samya",
  "nawaf",
  "ahmed",
  "mariam",
  "abdullah",
];

export const ROLE_LABELS: Record<Role, string> = {
  moeen: "Moeen",
  samya: "Samya",
  nawaf: "Nawaf",
  ahmed: "Ahmed",
  mariam: "Mariam",
  abdullah: "Abdullah",
  kitchen: "Kitchen",
  admin: "Admin",
};

export const LOGIN_LABELS: Record<Role, string> = { ...ROLE_LABELS };

/* ROLE_PASSWORDS used to live here: a plaintext password for every role,
   derived from the person's name, committed to the repo. It had no consumers,
   so it was pure exposure — anyone with read access could log in as anyone.
   Removed 2026-08-15, and every account was rotated onto a random passphrase
   at the same time. Passwords now exist only as scrypt hashes in the database
   and in the gitignored CREDENTIALS.local.md. Do not reintroduce them here. */

/** Human name for the actor (used in tasks, meals, etc.) */
export const ACTOR_NAME: Record<Role, string> = {
  moeen: "Baba",
  samya: "Mama",
  nawaf: "Nawaf",
  ahmed: "Ahmed",
  mariam: "Mariam",
  abdullah: "Abdullah",
  kitchen: "Kitchen",
  admin: "Admin",
};

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  moeen: "/panel/family",
  samya: "/panel/family",
  nawaf: "/panel/family",
  ahmed: "/panel/family",
  mariam: "/panel/family",
  abdullah: "/panel/abdullah",
  kitchen: "/panel/abdullah",
  admin: "/panel/admin",
};

/** Where a freshly logged-in user lands. Unknown/legacy roles are family. */
export function defaultRouteFor(role: string): string {
  return ROLE_DEFAULT_ROUTE[role as Role] ?? "/panel/family";
}

/** Default room for each user (auto-assigned when creating tasks) */
export const USER_DEFAULT_ROOM: Record<string, string> = {
  moeen: "Master Bedroom",
  samya: "Master Bedroom",
  nawaf: "Winklevi Room",
  ahmed: "Winklevi Room",
  mariam: "Mariam Room",
  abdullah: "Kitchen",
  kitchen: "Kitchen",
};

/** All rooms available for task assignment (metadata only, no dedicated panels) */
export const ALL_ROOMS = [
  "Kitchen",
  "Living Room",
  "Dining Room",
  "Master Bedroom",
  "Winklevi Room",
  "Mariam Room",
  "Outside",
  "None",
] as const;

/** Get the default room for the currently logged-in user */
export function getDefaultRoom(): string {
  if (typeof window === "undefined") return "None";
  const role = getStoredRole();
  return role ? (USER_DEFAULT_ROOM[role] || "None") : "None";
}

export const STORAGE_KEY = "shh_role";

const VALID_ROLES: Role[] = [...USER_ROLES, "kitchen", "admin"];

export const VISIBLE_ROLES = VALID_ROLES.filter((r) => r !== "admin");

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v && VALID_ROLES.includes(v as Role)) return v as Role;
  // Backward compat: legacy "house" / removed room roles → map to Moeen as fallback family member
  if (
    v === "house" ||
    v === "winklevi_room" ||
    v === "mariam_room" ||
    v === "master_bedroom" ||
    v === "dining_room" ||
    v === "living_room"
  ) {
    return "moeen";
  }
  return null;
}
