/**
 * Shared menu store for House Member (choose items) and Kitchen (view + add to groceries).
 * Meals store: breakfast/lunch/dinner selection synced across House, Kitchen, Abdullah.
 */

const MENU_STORAGE_KEY = "shh_menu_selection";
const MEALS_STORAGE_KEY = "shh_meals";

/** Shared food list for meal dropdowns and menu. */
export const MENU_ITEMS = [
  "Eggs",
  "Toast",
  "Pancakes",
  "Chicken",
  "Rice",
  "Pasta",
  "Soup",
  "Salad",
  "Sandwich",
  "Tea",
  "Coffee",
  "Juice",
] as const;

export type MenuItem = (typeof MENU_ITEMS)[number];

export type MealsSelection = {
  breakfast: string;
  lunch: string;
  dinner: string;
};

const DEFAULT_MEALS: MealsSelection = { breakfast: "", lunch: "", dinner: "" };

/** Selected meals (breakfast/lunch/dinner) – House sets, Kitchen/Abdullah read. */
export function getMeals(): MealsSelection {
  if (typeof window === "undefined") return { ...DEFAULT_MEALS };
  try {
    const raw = localStorage.getItem(MEALS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEALS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      breakfast: typeof parsed.breakfast === "string" ? parsed.breakfast : "",
      lunch: typeof parsed.lunch === "string" ? parsed.lunch : "",
      dinner: typeof parsed.dinner === "string" ? parsed.dinner : "",
    };
  } catch {
    return { ...DEFAULT_MEALS };
  }
}

export function setMeals(meals: Partial<MealsSelection> | MealsSelection): void {
  if (typeof window === "undefined") return;
  try {
    const current = getMeals();
    const next = { ...current, ...meals };
    localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("meals-updated"));
  } catch {
    // ignore
  }
}

/** Selected menu items (chosen by House Member). */
export function getSelectedMenuItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s: unknown) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function setSelectedMenuItems(items: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("menu-updated"));
  } catch {
    // ignore
  }
}

export function toggleMenuItem(item: string): void {
  const current = getSelectedMenuItems();
  const next = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
  setSelectedMenuItems(next);
}
