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

export const PERMISSIONS: Record<
  Role,
  Partial<Record<RolePermissionKey, boolean>>
> = {
  house: {
    delegateTasks: true,
    chooseMeals: true,
    viewTasks: true,
    viewMenu: true,
  },
  kitchen: {
    viewTasks: true,
    createTasks: true,
    createRecurring: true,
    createUrgent: true,
    assignTasks: true,
    editMenu: true,
    controlDevices: true,
    viewMenu: true,
    viewGroceries: true,
  },
  abdullah: {
    viewTasks: true,
    createTasks: true,
    createRecurring: true,
    createUrgent: true,
    assignTasks: true,
    viewMenu: true,
    viewGroceries: true,
    controlDevices: false,
  },
  winklevi_room: {
    viewTasks: true,
    viewMenu: true,
  },
  mariam_room: {
    viewTasks: true,
    viewMenu: true,
  },
  master_bedroom: {
    viewTasks: true,
    viewMenu: true,
  },
  dining_room: {
    viewTasks: true,
    viewMenu: true,
  },
  living_room: {
    viewTasks: true,
    viewMenu: true,
  },
  admin: {
    viewTasks: true,
    createTasks: true,
    assignTasks: true,
    createRecurring: true,
    createUrgent: true,
    controlDevices: true,
    editMenu: true,
    viewMenu: true,
    viewGroceries: true,
  },
};

/** Legacy permission keys used by sidebar and dashboard (derived from PERMISSIONS) */
export const ROLE_PERMISSIONS: Record<
  Role,
  {
    dashboard: boolean;
    tasks: boolean;
    meals: boolean;
    groceries: boolean;
    devices: boolean;
    family: boolean;
    settings: boolean;
    edit: boolean;
    reorder: boolean;
    controlDevices: boolean;
  }
> = {
  house: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: true,
    settings: false,
    edit: true,
    reorder: false,
    controlDevices: false,
  },
  kitchen: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: true,
    devices: true,
    family: true,
    settings: false,
    edit: true,
    reorder: true,
    controlDevices: true,
  },
  abdullah: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: true,
    devices: false,
    family: false,
    settings: false,
    edit: true,
    reorder: true,
    controlDevices: false,
  },
  winklevi_room: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: false,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  mariam_room: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: false,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  master_bedroom: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: false,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  dining_room: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: false,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  living_room: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: false,
    devices: false,
    family: false,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  admin: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: true,
    devices: true,
    family: true,
    settings: true,
    edit: true,
    reorder: true,
    controlDevices: true,
  },
};

type PermissionKey = keyof (typeof ROLE_PERMISSIONS)[Role];

export function can(role: Role | null, key: PermissionKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[key] ?? false;
}

export function canPermission(role: Role | null, key: RolePermissionKey): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.[key] ?? false;
}
