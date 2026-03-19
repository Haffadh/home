import type { TaskRow } from "../services/tasks";

/**
 * Swaps the time slots of two tasks (by id). Returns updated tasks with swapped start_time/end_time.
 */
export function swapTaskSlots(tasks: TaskRow[], idA: string, idB: string): TaskRow[] {
  const a = tasks.find((t) => t.id === idA);
  const b = tasks.find((t) => t.id === idB);
  if (!a || !b) return tasks;
  return tasks.map((t) => {
    if (t.id === idA) return { ...t, start_time: b.start_time, end_time: b.end_time };
    if (t.id === idB) return { ...t, start_time: a.start_time, end_time: a.end_time };
    return t;
  });
}
