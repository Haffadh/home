import type { Role } from "./roles";

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
  member: {
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
  cleaner: {
    dashboard: false,
    tasks: true,
    meals: true,
    groceries: true,
    devices: true,
    family: true,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
  viewer: {
    dashboard: true,
    tasks: true,
    meals: true,
    groceries: true,
    devices: true,
    family: true,
    settings: false,
    edit: false,
    reorder: false,
    controlDevices: false,
  },
};

type PermissionKey = keyof (typeof ROLE_PERMISSIONS)[Role];

export function can(role: Role | null, key: PermissionKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[key] ?? false;
}
