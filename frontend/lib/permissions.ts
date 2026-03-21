import type { Role } from "./roles";

/** New permission keys for role-based access */
export type RolePermissionKey =
  | "viewTasks"
  | "createTasks"
  | "assignTasks"
  | "createRecurring"
  | "createUrgent"
  | "controlDevices"
  | "editMenu"
  | "viewMenu"
  | "viewGroceries"
  | "delegateTasks"
  | "chooseMeals";

const FAMILY_PERMS: Partial<Record<RolePermissionKey, boolean>> = {
  delegateTasks: true,
  chooseMeals: true,
  viewTasks: true,
  viewMenu: true,
  createUrgent: true,
};

const ROOM_PERMS: Partial<Record<RolePermissionKey, boolean>> = {
  viewTasks: true,
  viewMenu: true,
};

export const PERMISSIONS: Record<
  Role,
  Partial<Record<RolePermissionKey, boolean>>
> = {
  moeen: FAMILY_PERMS,
  samya: FAMILY_PERMS,
  nawaf: FAMILY_PERMS,
  ahmed: FAMILY_PERMS,
  mariam: FAMILY_PERMS,
  kitchen: {
    viewTasks: true, createTasks: true, createRecurring: true, createUrgent: true,
    assignTasks: true, editMenu: true, controlDevices: true, viewMenu: true, viewGroceries: true,
  },
  abdullah: {
    viewTasks: true, createTasks: true, createRecurring: true, createUrgent: true,
    assignTasks: true, viewMenu: true, viewGroceries: true,
  },
  winklevi_room: ROOM_PERMS,
  mariam_room: ROOM_PERMS,
  master_bedroom: ROOM_PERMS,
  dining_room: ROOM_PERMS,
  living_room: ROOM_PERMS,
  admin: {
    viewTasks: true, createTasks: true, assignTasks: true, createRecurring: true,
    createUrgent: true, controlDevices: true, editMenu: true, viewMenu: true, viewGroceries: true,
  },
};

/** Legacy permission keys used by sidebar and dashboard */
type LegacyPerms = {
  dashboard: boolean; tasks: boolean; meals: boolean; groceries: boolean;
  devices: boolean; family: boolean; settings: boolean; edit: boolean;
  reorder: boolean; controlDevices: boolean;
};

const FAMILY_LEGACY: LegacyPerms = {
  dashboard: true, tasks: true, meals: true, groceries: false, devices: false,
  family: true, settings: false, edit: true, reorder: false, controlDevices: false,
};

const ROOM_LEGACY: LegacyPerms = {
  dashboard: true, tasks: true, meals: true, groceries: false, devices: false,
  family: false, settings: false, edit: false, reorder: false, controlDevices: false,
};

export const ROLE_PERMISSIONS: Record<Role, LegacyPerms> = {
  moeen: FAMILY_LEGACY,
  samya: FAMILY_LEGACY,
  nawaf: FAMILY_LEGACY,
  ahmed: FAMILY_LEGACY,
  mariam: FAMILY_LEGACY,
  kitchen: {
    dashboard: true, tasks: true, meals: true, groceries: true, devices: true,
    family: true, settings: false, edit: true, reorder: true, controlDevices: true,
  },
  abdullah: {
    dashboard: true, tasks: true, meals: true, groceries: true, devices: false,
    family: false, settings: false, edit: true, reorder: true, controlDevices: false,
  },
  winklevi_room: ROOM_LEGACY,
  mariam_room: ROOM_LEGACY,
  master_bedroom: ROOM_LEGACY,
  dining_room: ROOM_LEGACY,
  living_room: ROOM_LEGACY,
  admin: {
    dashboard: true, tasks: true, meals: true, groceries: true, devices: true,
    family: true, settings: true, edit: true, reorder: true, controlDevices: true,
  },
};

type PermissionKey = keyof LegacyPerms;

export function can(role: Role | null, key: PermissionKey): boolean {
  if (!role) return false;
  // Backward compat: old "house" role
  if (role === ("house" as Role)) return ROLE_PERMISSIONS.moeen?.[key] ?? false;
  return ROLE_PERMISSIONS[role]?.[key] ?? false;
}

export function canPermission(role: Role | null, key: RolePermissionKey): boolean {
  if (!role) return false;
  if (role === ("house" as Role)) return PERMISSIONS.moeen?.[key] ?? false;
  return PERMISSIONS[role]?.[key] ?? false;
}
