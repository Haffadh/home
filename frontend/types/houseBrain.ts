/**
 * Centralized types for House Brain state.
 */

export type TaskStatus = "pending" | "completed";

export type Task = {
  id: string;
  title: string;
  category: string;
  room: string;
  urgent: boolean;
  recurring: boolean;
  createdBy: string;
  status: TaskStatus;
  /** Optional: for API/scheduling compatibility */
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  order?: number;
};

export type RequestedBy = "Baba" | "Mama" | "Nawaf" | "Ahmed" | "Mariam";

export type MealEntry = {
  dish: string;
  drink: string;
  requestedBy: RequestedBy;
  peopleCount: number;
  /** Extra options e.g. Eggs: cooking style, quantity, toppings; Yogurt: toppings */
  options?: Record<string, string>;
};

export type MealsState = {
  breakfast: MealEntry | null;
  lunch: MealEntry | null;
  dinner: MealEntry | null;
};

export type GroceryItem = {
  id: string;
  title: string;
  requestedBy?: string;
  bought: boolean;
  source?: "manual" | "inventory" | "photo" | "handwritten";
  createdAt?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  threshold: number;
  /** Abdullah confirms during weekly check */
  lastConfirmedAt?: string | null;
};

export type Scene = {
  id: string;
  name: string;
  emoji: string;
  description: string;
};
