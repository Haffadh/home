/**
 * Task categories and their display icons (small, beside task title).
 * Icons are Unicode/emoji for zero dependency.
 */

export const TASK_CATEGORIES = [
  { value: "cleaning", label: "Cleaning", icon: "🧹" },
  { value: "food_prep", label: "Food Prep", icon: "👨‍🍳" },
  { value: "groceries", label: "Groceries", icon: "🛒" },
  { value: "maintenance", label: "Maintenance", icon: "🔧" },
  { value: "room_setup", label: "Room Setup", icon: "🛋️" },
  { value: "laundry", label: "Laundry", icon: "👕" },
  { value: "misc", label: "Misc", icon: "⋯" },
] as const;

export type TaskCategoryValue = (typeof TASK_CATEGORIES)[number]["value"];

export const TASK_CATEGORY_MAP: Record<string, { label: string; icon: string }> = Object.fromEntries(
  TASK_CATEGORIES.map((c) => [c.value, { label: c.label, icon: c.icon }])
);

export function getCategoryIcon(category: string): string {
  return TASK_CATEGORY_MAP[category]?.icon ?? "⋯";
}

export function getCategoryLabel(category: string): string {
  return TASK_CATEGORY_MAP[category]?.label ?? "Misc";
}
