import type { TaskRow } from "../services/tasks";

/**
 * Returns the task that spans the given time (Abdullah's "current" task).
 * Assumes tasks are for the same day and have start_time <= time < end_time.
 */
export function getCurrentTask(tasks: TaskRow[], atTime: Date): TaskRow | null {
  const ts = atTime.getTime();
  for (const t of tasks) {
    const start = new Date(t.start_time).getTime();
    const end = new Date(t.end_time).getTime();
    if (t.status === "completed") continue;
    if (ts >= start && ts < end) return t;
  }
  return null;
}
