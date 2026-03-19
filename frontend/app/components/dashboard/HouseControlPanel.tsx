"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase, withActorBody } from "../../../lib/api";
import { useRealtimeTable } from "../../../lib/useRealtimeTable";
import { getStoredRole } from "../../../lib/roles";
import { useHouseBrain } from "../../../stores/houseBrain";
import { useMeals } from "../../../lib/useMeals";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import * as tasksService from "../../../lib/services/tasks";
import * as groceriesService from "../../../lib/services/groceries";
import { taskRowsToUI } from "../../../lib/adapters/tasks";
import { getCurrentTask } from "../../../lib/scheduling/getCurrentTask";
import { applyShiftTasksForward } from "../../../lib/scheduling/applySchedulingToSupabase";
import AbdullahBusyModal from "./AbdullahBusyModal";
import { TASK_CATEGORIES } from "../../../lib/taskCategories";
import type { TaskRow } from "../../../lib/services/tasks";
import { getCategoryIcon } from "../../../lib/taskCategories";
import { ROOM_OPTIONS } from "../../../lib/rooms";
import {
  BREAKFAST_ITEMS,
  LUNCH_ITEMS,
  DINNER_ITEMS,
  DRINK_OPTIONS,
  MEAL_REQUESTED_BY,
} from "../../../data/menu";
import type { MealEntry } from "../../../types/houseBrain";

function useMenuItems() {
  const { customDishes } = useHouseBrain();
  return [
    { key: "breakfast" as const, label: "Breakfast", items: [...BREAKFAST_ITEMS, ...customDishes.breakfast] },
    { key: "lunch" as const, label: "Lunch", items: [...LUNCH_ITEMS, ...customDishes.lunch] },
    { key: "dinner" as const, label: "Dinner", items: [...DINNER_ITEMS, ...customDishes.dinner] },
  ];
}

const emptyMealEntry = (): MealEntry => ({
  dish: "",
  drink: "",
  requestedBy: "Baba",
  peopleCount: 1,
});

const PORTION_PRESETS = [1, 2, 3, 4, 5, 6] as const;

function PortionDropdown({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const isPreset = value >= 1 && value <= 6;
  const [useCustom, setUseCustom] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(!isPreset ? String(value) : "7");

  const effectiveValue = useCustom
    ? (customInput === "" ? 1 : Math.max(1, parseInt(customInput, 10) || 1))
    : value;

  function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "custom") {
      setUseCustom(true);
      onChange(effectiveValue);
    } else {
      setUseCustom(false);
      const n = Math.max(1, parseInt(v, 10) || 1);
      onChange(n);
    }
  }

  function handleCustomInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
    setCustomInput(raw);
    const n = raw === "" ? 1 : Math.max(1, parseInt(raw, 10) || 1);
    onChange(n);
  }

  return (
    <div className="space-y-2">
      <select
        value={useCustom ? "custom" : (value >= 1 && value <= 6 ? value : 1)}
        onChange={handlePresetChange}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
      >
        {PORTION_PRESETS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
        <option value="custom">Custom</option>
      </select>
      {useCustom && (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Number of people"
          value={customInput}
          onChange={handleCustomInputChange}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80 placeholder:text-white/40"
        />
      )}
    </div>
  );
}

const cardStyle = "rounded-2xl bg-slate-800/50 backdrop-blur-md border border-white/[0.06]";

function MealSelectorModal({
  slot,
  slotLabel,
  entry,
  items,
  onSave,
  onClose,
}: {
  slot: "breakfast" | "lunch" | "dinner";
  slotLabel: string;
  entry: MealEntry;
  items: readonly string[];
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<MealEntry>(entry);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-sm rounded-2xl p-6 ${cardStyle} shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white/95 mb-4">{slotLabel}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">Dish</label>
            <select
              value={local.dish}
              onChange={(e) => setLocal({ ...local, dish: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              <option value="">— Select —</option>
              {items.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Drink</label>
            <select
              value={local.drink}
              onChange={(e) => setLocal({ ...local, drink: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              <option value="">— Select —</option>
              {DRINK_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Assigned person</label>
            <select
              value={local.requestedBy}
              onChange={(e) => setLocal({ ...local, requestedBy: e.target.value as MealEntry["requestedBy"] })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              {MEAL_REQUESTED_BY.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Portion size (people)</label>
            <PortionDropdown
              value={local.peopleCount}
              onChange={(n) => setLocal({ ...local, peopleCount: n })}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-white/10 text-white/90">
            Cancel
          </button>
          <button type="button" onClick={() => { onSave(local); onClose(); }} className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-slate-600/80 text-white/90">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (opts: { title: string; category: string; room: string; urgent: boolean; recurring: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("misc");
  const [room, setRoom] = useState("kitchen");
  const [urgent, setUrgent] = useState(false);
  const [recurring, setRecurring] = useState(false);

  function handleSubmit() {
    const t = title.trim();
    if (!t) return;
    onSubmit({ title: t, category, room, urgent, recurring });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-sm rounded-2xl p-6 ${cardStyle} shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white/95 mb-4">Create Task</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80 placeholder:text-white/40"
          />
          <div>
            <label className="block text-xs text-white/50 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Room (optional)</label>
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white/95 border border-white/10 bg-slate-800/80"
            >
              {ROOM_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="rounded w-4 h-4" />
              <span className="text-sm text-white/90">Urgent</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="rounded w-4 h-4" />
              <span className="text-sm text-white/90">Recurring</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-white/10 text-white/90">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!title.trim()} className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-slate-600/80 text-white/90 disabled:opacity-50">
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HouseControlPanel() {
  const { customDishes } = useHouseBrain();
  const { meals, setMealSlot } = useMeals();
  const SLOTS = useMenuItems();
  const role = typeof window !== "undefined" ? getStoredRole() : null;

  const [mealModalSlot, setMealModalSlot] = useState<"breakfast" | "lunch" | "dinner" | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [groceryInput, setGroceryInput] = useState("");
  const [todayTasks, setTodayTasks] = useState<{ id: string; title: string; category: string; status: string; urgent?: boolean }[]>([]);
  const [abdullahBusy, setAbdullahBusy] = useState<{
    taskName: string;
    untilTime: string;
    opts: { title: string; category: string; room: string; urgent: boolean; recurring: boolean };
    currentTask: TaskRow;
    todayRows: TaskRow[];
  } | null>(null);

  const loadTodayTasks = useCallback(async () => {
    if (!getSupabaseClient()) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await tasksService.fetchTasks({ date: today });
      const ui = taskRowsToUI(rows);
      setTodayTasks(ui.filter((t) => t.status !== "completed").map((t) => ({ id: t.id, title: t.title, category: t.category ?? "", status: t.status, urgent: t.urgent })));
    } catch {
      setTodayTasks([]);
    }
  }, []);

  useRealtimeTable("tasks", loadTodayTasks);

  async function handleCreateTask(opts: { title: string; category: string; room: string; urgent: boolean; recurring: boolean }) {
    if (opts.urgent) {
      if (!getSupabaseClient()) {
        getApiBase("/api/urgent_tasks", { method: "POST", body: withActorBody({ title: opts.title }) }).catch(() => {});
        return;
      }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await tasksService.fetchTasks({ date: today });
        const pending = rows.filter((r) => r.status !== "completed").sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        const current = getCurrentTask(rows, new Date());
        if (current) {
          const untilTime = new Date(current.end_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
          setAbdullahBusy({
            taskName: current.title,
            untilTime,
            opts,
            currentTask: current,
            todayRows: pending,
          });
          return;
        }
        getApiBase("/api/urgent_tasks", { method: "POST", body: withActorBody({ title: opts.title }) }).catch(() => {});
      } catch {
        getApiBase("/api/urgent_tasks", { method: "POST", body: withActorBody({ title: opts.title }) }).catch(() => {});
      }
      return;
    }
    if (!getSupabaseClient()) return;
    try {
      const start = new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await tasksService.createTask({
        title: opts.title,
        assigned_by: role ?? "House",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration: 60,
        room: opts.room,
      });
      await loadTodayTasks();
    } catch {
      // ignore
    }
  }

  async function handleAbdullahBusyUrgent() {
    if (!abdullahBusy) return;
    getApiBase("/api/urgent_tasks", { method: "POST", body: withActorBody({ title: abdullahBusy.opts.title }) }).catch(() => {});
    setAbdullahBusy(null);
    setCreateTaskOpen(false);
  }

  async function handleAbdullahBusyCanWait() {
    if (!abdullahBusy || !getSupabaseClient()) return;
    const { opts, currentTask } = abdullahBusy;
    const durationMs = 60 * 60 * 1000;
    const startTime = currentTask.end_time;
    const endTime = new Date(new Date(currentTask.end_time).getTime() + durationMs).toISOString();
    try {
      const newTask = await tasksService.createTask({
        title: opts.title,
        assigned_by: role ?? "House",
        start_time: startTime,
        end_time: endTime,
        duration: 60,
        room: opts.room,
      });
      const today = new Date().toISOString().slice(0, 10);
      const rows = await tasksService.fetchTasks({ date: today });
      const pending = rows.filter((r) => r.status !== "completed").sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      const newIdx = pending.findIndex((r) => r.id === newTask.id);
      if (newIdx !== -1 && newIdx + 1 < pending.length) {
        await applyShiftTasksForward(pending, newIdx + 1, durationMs);
      }
      await loadTodayTasks();
    } catch {
      // ignore
    }
    setAbdullahBusy(null);
    setCreateTaskOpen(false);
  }

  async function handleAddGrocery(e: React.FormEvent) {
    e.preventDefault();
    const t = groceryInput.trim();
    if (!t) return;
    if (getSupabaseClient()) {
      try {
        await groceriesService.addGrocery({ title: t, requested_by: "House" });
        setGroceryInput("");
      } catch {
        // ignore
      }
    }
  }

  async function handleCompleteTask(id: string) {
    if (!getSupabaseClient()) return;
    try {
      await tasksService.completeTask(id);
      await loadTodayTasks();
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-[1024px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-5">
      {/* Row 1: Meals — three cards */}
      <section>
        <h2 className="text-xl font-semibold text-white/90 mb-4">Meals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {SLOTS.map(({ key, label, items }) => {
            const entry = meals[key] ?? emptyMealEntry();
            const hasContent = entry.dish || entry.drink;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMealModalSlot(key)}
                className={`${cardStyle} p-5 text-left transition hover:bg-slate-800/70 active:scale-[0.99] min-h-[100px] flex flex-col justify-center`}
              >
                <span className="text-base font-medium text-white/95">{label}</span>
                <span className="text-sm text-white/70 mt-0.5">{entry.requestedBy || "—"}</span>
                <span className="text-xs text-white/50 mt-0.5">{entry.peopleCount ? `${entry.peopleCount} pax` : "—"}</span>
                {hasContent && (
                  <span className="text-[0.8125rem] text-white/60 mt-1 truncate">{entry.dish || entry.drink}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Row 2: Create Task — large button card */}
      <section>
        <button
          type="button"
          onClick={() => setCreateTaskOpen(true)}
          className={`w-full ${cardStyle} p-6 flex items-center justify-center gap-3 transition hover:bg-slate-800/70 active:scale-[0.99]`}
        >
          <span className="text-xl">+</span>
          <span className="text-lg font-semibold text-white/95">Create Task</span>
        </button>
      </section>

      {/* Row 3: Today's Tasks */}
      <section className={`flex-1 min-h-0 flex flex-col ${cardStyle} p-4`}>
        <h2 className="text-xl font-semibold text-white/90 mb-3">Today&apos;s Tasks</h2>
        <ul className="space-y-2 min-h-0 overflow-auto">
          {todayTasks.length === 0 ? (
            <li className="text-[0.8125rem] text-white/45">No tasks for today.</li>
          ) : (
            todayTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl bg-slate-800/40 px-3.5 py-2.5 border border-white/[0.04]"
              >
                <span className="text-base shrink-0">{getCategoryIcon(t.category)}</span>
                <span className="flex-1 text-[0.875rem] text-white/90 truncate">{t.title}</span>
                {t.urgent && <span className="text-[0.6875rem] text-amber-400/90">Urgent</span>}
                <button
                  type="button"
                  onClick={() => handleCompleteTask(t.id)}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-[0.75rem] font-medium text-white/80 hover:bg-white/15"
                >
                  Done
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Row 4: Quick Grocery Add */}
      <section className={`${cardStyle} p-4`}>
        <h2 className="text-base font-semibold text-white/90 mb-3">Quick Grocery Add</h2>
        <form onSubmit={handleAddGrocery} className="flex gap-3">
          <input
            type="text"
            placeholder="Add item…"
            value={groceryInput}
            onChange={(e) => setGroceryInput(e.target.value)}
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-[0.9375rem] text-white/95 placeholder:text-white/40 border border-white/10 bg-slate-800/80 focus:outline-none focus:border-white/20"
          />
          <button
            type="submit"
            disabled={!groceryInput.trim()}
            className="rounded-xl bg-white/10 hover:bg-white/15 px-5 py-3 text-sm font-medium text-white/90 disabled:opacity-50 transition"
          >
            Add
          </button>
        </form>
      </section>

      {/* Modals */}
      {mealModalSlot && (
        <MealSelectorModal
          slot={mealModalSlot}
          slotLabel={SLOTS.find((s) => s.key === mealModalSlot)?.label ?? mealModalSlot}
          entry={meals[mealModalSlot] ?? emptyMealEntry()}
          items={SLOTS.find((s) => s.key === mealModalSlot)?.items ?? []}
          onSave={async (entry) => { await setMealSlot(mealModalSlot, entry); }}
          onClose={() => setMealModalSlot(null)}
        />
      )}
      {createTaskOpen && (
        <CreateTaskModal
          onClose={() => setCreateTaskOpen(false)}
          onSubmit={handleCreateTask}
        />
      )}
      {abdullahBusy && (
        <AbdullahBusyModal
          taskName={abdullahBusy.taskName}
          untilTime={abdullahBusy.untilTime}
          onUrgent={handleAbdullahBusyUrgent}
          onCanWait={handleAbdullahBusyCanWait}
          onClose={() => { setAbdullahBusy(null); }}
        />
      )}
    </div>
  );
}
