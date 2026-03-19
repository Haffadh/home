import type { TaskRow } from "../services/tasks";

/**
 * Inserts a new task block immediately after the current task and shifts later tasks forward.
 * Returns the list of tasks with updated start_time/end_time (including the new task).
 */
export function insertTaskAfterCurrentTask(
  tasks: TaskRow[],
  currentTaskId: string,
  newTask: { title: string; duration: number; assigned_by?: string | null; room?: string | null }
): TaskRow[] {
  const sorted = [...tasks].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const idx = sorted.findIndex((t) => t.id === currentTaskId);
  if (idx === -1) return tasks;
  const current = sorted[idx];
  const currentEnd = new Date(current.end_time).getTime();
  const durationMs = newTask.duration * 60 * 1000;
  const newStart = currentEnd;
  const newEnd = currentEnd + durationMs;
  const newTaskRow: TaskRow = {
    id: `temp-${Date.now()}`,
    title: newTask.title,
    assigned_by: newTask.assigned_by ?? null,
    start_time: new Date(newStart).toISOString(),
    end_time: new Date(newEnd).toISOString(),
    duration: newTask.duration,
    urgent: false,
    room: newTask.room ?? null,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  const shifted = shiftTasksForward(sorted, idx + 1, durationMs);
  const result = [...shifted.slice(0, idx + 1), newTaskRow, ...shifted.slice(idx + 1)];
  return result.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
