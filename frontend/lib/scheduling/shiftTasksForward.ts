import type { TaskRow } from "../services/tasks";

/**
 * Shifts all tasks from fromIndex forward by amountMs. Modifies start_time and end_time.
 */
export function shiftTasksForward(
  tasks: TaskRow[],
  fromIndex: number,
  amountMs: number
): TaskRow[] {
  const sorted = [...tasks].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return sorted.map((t, i) => {
    if (i < fromIndex) return t;
    return {
      ...t,
      start_time: new Date(new Date(t.start_time).getTime() + amountMs).toISOString(),
      end_time: new Date(new Date(t.end_time).getTime() + amountMs).toISOString(),
    };
  });
}
