"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredRole } from "../../../lib/roles";
import type { Role } from "../../../lib/roles";
import { can } from "../../../lib/permissions";
import { useHouseBrain } from "../../../stores/houseBrain";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/api";
import * as groceriesService from "../../../lib/services/groceries";
import * as devicesService from "../../../lib/services/devices";
import * as tasksService from "../../../lib/services/tasks";
import * as inventoryService from "../../../lib/services/inventory";
import * as mealsService from "../../../lib/services/meals";
import * as scenesService from "../../../lib/services/scenes";
import * as runMealIntelligence from "../../../lib/meals/runMealIntelligence";
import { generateGroceryPDF } from "../../../lib/pdf/groceryPdf";
import ScenesCard from "./ScenesCard";
import UrgentTasksCard from "./UrgentTasksCard";
import DailyTasksCard from "./DailyTasksCard";
import MealsCard from "./MealsCard";
import MealSuggestionsCard from "./MealSuggestionsCard";
import HouseBrainTasksCard from "./HouseBrainTasksCard";
import GroceriesCard from "./GroceriesCard";
import InventoryAuditCard from "./InventoryAuditCard";
import ActivityBubble from "./ActivityBubble";

export type MainDashboardProps = {
  showAdminControls?: boolean;
  /** Simplified layout: only Today's Tasks + Urgent Tasks (e.g. cleaner) */
  simplified?: boolean;
  /** Abdullah layout: Today's Tasks + Urgent + Recurring only; no Scenes, no Meals */
  layout?: "full" | "abdullah";
  /** Extra CSS class for the container (e.g. cleaner mobile layout) */
  className?: string;
};

export default function MainDashboard({
  showAdminControls = false,
  simplified = false,
  layout = "full",
  className = "",
}: MainDashboardProps) {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    setRole(getStoredRole());
  }, []);
  const canEditTasks = can(role, "edit");
  const canControlDevices = can(role, "controlDevices");
  const canReorder = can(role, "reorder");
  const readOnly = !can(role, "edit");
  const isAbdullah = layout === "abdullah";
  const { addScene, addCustomDish } = useHouseBrain();

  const loadDashboard = useCallback(async () => {
    console.log("[MainDashboard] loadDashboard() starting...");
    try {
      await Promise.all([
        devicesService.fetchDevices(),
        tasksService.fetchTasksFromApi(),
        groceriesService.fetchGroceriesFromApi(),
        mealsService.fetchMealsFromApi(),
        inventoryService.fetchInventoryFromApi(),
        scenesService.fetchScenes(),
        getApiBase("/api/urgent_tasks", { cache: "no-store" }),
        runMealIntelligence.runMealIntelligence(),
      ]);
    } catch (err) {
      console.error("[MainDashboard] loadDashboard failed", err);
    } finally {
      console.log("[MainDashboard] loadDashboard() finished");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const [newSceneName, setNewSceneName] = useState("");
  const [newSceneEmoji, setNewSceneEmoji] = useState("✨");
  const [newSceneDesc, setNewSceneDesc] = useState("");
  const [newDish, setNewDish] = useState("");
  const [newDishType, setNewDishType] = useState<"breakfast" | "lunch" | "dinner">("lunch");

  async function handleDownloadGroceryPdf() {
    if (!getSupabaseClient()) return;
    try {
      const rows = await groceriesService.fetchGroceries();
      generateGroceryPDF(rows);
    } catch {
      // ignore
    }
  }

  return (
    <div className={`min-h-full flex flex-col max-w-screen-2xl mx-auto w-full ${className}`}>
      {showAdminControls && (
        <>
          <section className="mb-4 shrink-0 space-y-4">
            <h2 className="text-xl font-semibold text-white/90 tracking-tight">Admin Controls</h2>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-xl bg-[#1e293b]/60 backdrop-blur-lg border border-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Manage Users
              </span>
              <span className="rounded-xl bg-[#1e293b]/60 backdrop-blur-lg border border-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                System Logs
              </span>
              <span className="rounded-xl bg-[#1e293b]/60 backdrop-blur-lg border border-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Device Pairing
              </span>
              <span className="rounded-xl bg-[#1e293b]/60 backdrop-blur-lg border border-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Global Settings
              </span>
            </div>
          </section>
          <div className="mb-4 shrink-0 max-w-md">
            <ActivityBubble />
          </div>
          <section className="mb-4 shrink-0 space-y-3 rounded-2xl bg-slate-900/60 p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-white/90">Add scene</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <input type="text" placeholder="Name" value={newSceneName} onChange={(e) => setNewSceneName(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white/95 border border-white/10 bg-slate-800/80 w-32" />
              <input type="text" placeholder="Emoji" value={newSceneEmoji} onChange={(e) => setNewSceneEmoji(e.target.value)} className="rounded-lg px-2 py-2 text-sm w-14 text-center" />
              <input type="text" placeholder="Description" value={newSceneDesc} onChange={(e) => setNewSceneDesc(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white/95 border border-white/10 bg-slate-800/80 flex-1 min-w-0" />
              <button type="button" onClick={() => { if (newSceneName.trim()) { addScene({ name: newSceneName.trim(), emoji: newSceneEmoji || "✨", description: newSceneDesc.trim() }); setNewSceneName(""); setNewSceneDesc(""); } }} className="rounded-lg bg-slate-600/80 px-3 py-2 text-sm text-white/90">Add scene</button>
            </div>
          </section>
          <section className="mb-4 shrink-0 space-y-3 rounded-2xl bg-slate-900/60 p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-white/90">Add dish (menu)</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <select value={newDishType} onChange={(e) => setNewDishType(e.target.value as "breakfast" | "lunch" | "dinner")} className="rounded-lg px-3 py-2 text-sm text-white/95 border border-white/10 bg-slate-800/80">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
              <input type="text" placeholder="Dish name" value={newDish} onChange={(e) => setNewDish(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white/95 border border-white/10 bg-slate-800/80 flex-1 min-w-0" />
              <button type="button" onClick={() => { if (newDish.trim()) { addCustomDish(newDishType, newDish.trim()); setNewDish(""); } }} className="rounded-lg bg-slate-600/80 px-3 py-2 text-sm text-white/90">Add dish</button>
            </div>
          </section>
        </>
      )}

      {simplified ? (
        <div className="flex flex-col flex-1 min-h-0 gap-8">
          <UrgentTasksCard canEditTasks={canEditTasks} readOnly={readOnly} simplified />
          <div className="min-h-0 flex flex-col flex-1">
            <DailyTasksCard readOnly={readOnly} canEditTasks={canEditTasks} canReorder={canReorder} simplified />
          </div>
        </div>
      ) : isAbdullah ? (
        <div className="flex flex-col flex-1 min-h-0 gap-6 overflow-auto">
          <HouseBrainTasksCard readOnly={readOnly} title="Today's Tasks" />
          <HouseBrainTasksCard readOnly={readOnly} urgentOnly title="Urgent Tasks" />
          <div className="min-h-0 flex flex-col flex-1 gap-4">
            <MealsCard readOnly={readOnly} canEditTasks={canEditTasks} />
            <MealSuggestionsCard />
          </div>
          <GroceriesCard maxItems={8} />
          <InventoryAuditCard />
          <section className="rounded-2xl bg-slate-900/60 p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-white/90 mb-2">Abdullah</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadGroceryPdf}
                className="rounded-xl bg-slate-700/80 px-4 py-2.5 text-sm text-white/90 hover:bg-slate-700 transition"
              >
                Download grocery list (PDF)
              </button>
              <button type="button" className="rounded-xl bg-slate-700/80 px-4 py-2.5 text-sm text-white/90">
                Ask AI &quot;How to?&quot;
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-4 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
            <ScenesCard readOnly={readOnly || !canControlDevices} />
            <UrgentTasksCard canEditTasks={canEditTasks} readOnly={readOnly} />
            <HouseBrainTasksCard readOnly={readOnly} title="Today's Tasks" />
          </div>
          <div className="shrink-0">
            <MealsCard readOnly={readOnly} canEditTasks={canEditTasks} />
          </div>
        </div>
      )}
    </div>
  );
}
