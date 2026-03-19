import type { TaskRow } from "../services/tasks";
import * as tasksService from "../services/tasks";
import { shiftTasksForward } from "./shiftTasksForward";
import { shiftTasksBackward } from "./shiftTasksBackward";
import { swapTaskSlots } from "./swapTaskSlots";

/**
 * Applies shift forward to Supabase: updates start_time/end_time for all tasks from fromIndex onward.
 */
export async function applyShiftTasksForward(
  tasks: TaskRow[],
  fromIndex: number,
  amountMs: number
): Promise<void> {
  const shifted = shiftTasksForward(tasks, fromIndex, amountMs);
  for (let i = fromIndex; i < shifted.length; i++) {
    const t = shifted[i];
    await tasksService.updateTask(t.id, { start_time: t.start_time, end_time: t.end_time, duration: t.duration });
  }
}

/**
 * Applies shift backward to Supabase: updates start_time/end_time for all tasks from fromIndex onward.
 */
export async function applyShiftTasksBackward(
  tasks: TaskRow[],
  fromIndex: number,
  amountMs: number
): Promise<void> {
  const shifted = shiftTasksBackward(tasks, fromIndex, amountMs);
  for (let i = fromIndex; i < shifted.length; i++) {
    const t = shifted[i];
    await tasksService.updateTask(t.id, { start_time: t.start_time, end_time: t.end_time, duration: t.duration });
  }
}

/**
 * Swaps time slots of two tasks in Supabase.
 */
export async function applySwapTaskSlots(
  taskA: TaskRow,
  taskB: TaskRow
): Promise<void> {
  const tasks = [taskA, taskB];
  const swapped = swapTaskSlots(tasks, taskA.id, taskB.id);
  const a = swapped.find((t) => t.id === taskA.id)!;
  const b = swapped.find((t) => t.id === taskB.id)!;
  const durationMinutes = (iso: string, iso2: string) =>
    Math.max(1, Math.round((new Date(iso2).getTime() - new Date(iso).getTime()) / (60 * 1000)));
  await Promise.all([
    tasksService.updateTask(taskA.id, {
      start_time: a.start_time,
      end_time: a.end_time,
      duration: durationMinutes(a.start_time, a.end_time),
    }),
    tasksService.updateTask(taskB.id, {
      start_time: b.start_time,
      end_time: b.end_time,
      duration: durationMinutes(b.start_time, b.end_time),
    }),
  ]);
}
