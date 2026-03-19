"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Task,
  MealsState,
  GroceryItem,
  InventoryItem,
  Scene,
  MealEntry,
} from "../types/houseBrain";

const DEFAULT_MEALS: MealsState = {
  breakfast: null,
  lunch: null,
  dinner: null,
};

const DEFAULT_SCENES: Scene[] = [
  { id: "shower", name: "Shower Mode", emoji: "🚿", description: "Towel heaters ON for 45 min" },
  { id: "away", name: "Away Mode", emoji: "🚪", description: "Doors locked • Lights off" },
  { id: "sleep", name: "Sleep Mode", emoji: "🌙", description: "Lights off • Quiet • AC off" },
  { id: "gathering", name: "Gathering Mode", emoji: "🍷", description: "Prepare living room & snacks" },
];

function nextId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `hb-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type CustomDishes = { breakfast: string[]; lunch: string[]; dinner: string[] };

type HouseBrainState = {
  tasks: Task[];
  meals: MealsState;
  groceries: GroceryItem[];
  inventory: InventoryItem[];
  scenes: Scene[];
  customDishes: CustomDishes;
  // Actions
  addTask: (task: Omit<Task, "id">) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setTasks: (tasks: Task[]) => void;
  setMeals: (meals: Partial<MealsState> | MealsState) => void;
  setMealSlot: (slot: "breakfast" | "lunch" | "dinner", entry: MealEntry | null) => void;
  addGrocery: (item: Omit<GroceryItem, "id" | "bought">) => GroceryItem;
  updateGrocery: (id: string, updates: Partial<GroceryItem>) => void;
  removeGrocery: (id: string) => void;
  setGroceries: (items: GroceryItem[]) => void;
  addInventoryItem: (item: Omit<InventoryItem, "id">) => InventoryItem;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  setInventoryItemQuantity: (id: string, quantity: number, confirmedAt?: string) => void;
  removeInventoryItem: (id: string) => void;
  setInventory: (items: InventoryItem[]) => void;
  addScene: (scene: Omit<Scene, "id">) => Scene;
  setScenes: (scenes: Scene[]) => void;
  addCustomDish: (mealType: "breakfast" | "lunch" | "dinner", dish: string) => void;
  getTasksByRoom: (room: string) => Task[];
  getTodayTasks: () => Task[];
  addGroceryFromLowInventory: (inventoryItem: InventoryItem) => void;
};

export const useHouseBrain = create<HouseBrainState>()(
  persist(
    (set, get) => ({
      tasks: [],
      meals: DEFAULT_MEALS,
      groceries: [],
      inventory: [],
      scenes: DEFAULT_SCENES,
      customDishes: { breakfast: [], lunch: [], dinner: [] },

      addTask: (task) => {
        const today = new Date().toISOString().slice(0, 10);
        const newTask: Task = {
          ...task,
          id: nextId(),
          status: task.status ?? "pending",
          date: task.date ?? today,
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return newTask;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      removeTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      },

      setTasks: (tasks) => set({ tasks }),

      setMeals: (meals) => {
        set((state) => ({ meals: { ...state.meals, ...meals } }));
      },

      setMealSlot: (slot, entry) => {
        set((state) => ({
          meals: { ...state.meals, [slot]: entry },
        }));
      },

      addGrocery: (item) => {
        const newItem: GroceryItem = {
          ...item,
          id: nextId(),
          bought: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ groceries: [...state.groceries, newItem] }));
        return newItem;
      },

      updateGrocery: (id, updates) => {
        set((state) => ({
          groceries: state.groceries.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },

      removeGrocery: (id) => {
        set((state) => ({
          groceries: state.groceries.filter((g) => g.id !== id),
        }));
      },

      setGroceries: (items) => set({ groceries: items }),

      addInventoryItem: (item) => {
        const newItem: InventoryItem = {
          ...item,
          id: nextId(),
          threshold: item.threshold ?? 1,
        };
        set((state) => ({ inventory: [...state.inventory, newItem] }));
        return newItem;
      },

      updateInventoryItem: (id, updates) => {
        set((state) => ({
          inventory: state.inventory.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        }));
      },

      setInventoryItemQuantity: (id, quantity, confirmedAt) => {
        set((state) => ({
          inventory: state.inventory.map((i) =>
            i.id === id
              ? {
                  ...i,
                  quantity,
                  ...(confirmedAt && { lastConfirmedAt: confirmedAt }),
                }
              : i
          ),
        }));
      },

      removeInventoryItem: (id) => {
        set((state) => ({
          inventory: state.inventory.filter((i) => i.id !== id),
        }));
      },

      setInventory: (items) => set({ inventory: items }),

      addScene: (scene) => {
        const id = scene.name ? scene.name.toLowerCase().replace(/\s+/g, "_") : nextId();
        const newScene: Scene = { ...scene, id };
        set((state) => ({ scenes: [...state.scenes, newScene] }));
        return newScene;
      },

      setScenes: (scenes) => set({ scenes }),

      addCustomDish: (mealType, dish) => {
        const trimmed = dish.trim();
        if (!trimmed) return;
        set((state) => ({
          customDishes: {
            ...state.customDishes,
            [mealType]: [...state.customDishes[mealType], trimmed],
          },
        }));
      },

      getTasksByRoom: (room) => {
        return get().tasks.filter((t) => t.room === room && t.status !== "completed");
      },

      getTodayTasks: () => {
        const today = new Date().toISOString().slice(0, 10);
        return get().tasks.filter(
          (t) => (t.date === today || !t.date) && t.status !== "completed"
        );
      },

      /** Call when inventory item quantity is below threshold; adds a grocery list item. */
      addGroceryFromLowInventory: (inventoryItem: InventoryItem) => {
        const existing = get().groceries.some(
          (g) => g.title.toLowerCase() === inventoryItem.name.toLowerCase() && !g.bought
        );
        if (!existing) {
          get().addGrocery({
            title: inventoryItem.name,
            requestedBy: "inventory",
            source: "inventory",
          });
        }
      },
    }),
    { name: "house-brain", partialize: (s) => ({ inventory: s.inventory, scenes: s.scenes, customDishes: s.customDishes }) }
  )
);
