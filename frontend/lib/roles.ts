export type Role = "admin" | "member" | "cleaner" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "House Member",
  cleaner: "Cleaner",
  viewer: "Viewer",
};

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  admin: "/panel/admin",
  member: "/panel/member",
  cleaner: "/panel/cleaner",
  viewer: "/panel/viewer",
};

export const STORAGE_KEY = "shh_role";

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "admin" || v === "member" || v === "cleaner" || v === "viewer") return v;
  return null;
}
