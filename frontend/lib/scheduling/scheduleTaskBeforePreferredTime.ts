import type { TaskRow } from "../services/tasks";

/**
 * Finds a slot before preferredTime that fits the given duration without overlapping existing tasks.
 * Returns the new task with start_time and end_time set, or null if no slot found.
 */
export function scheduleTaskBeforePreferredTime(
  existingTasks: TaskRow[],
  preferredTimeIso: string,
  durationMinutes: number,
  taskDate: string
): { start_time: string; end_time: string } | null {
  const preferred = new Date(preferredTimeIso).getTime();
  const durationMs = durationMinutes * 60 * 1000;
  const dayStart = new Date(`${taskDate}T00:00:00`).getTime();
  const sameDayTasks = existingTasks
    .filter((t) => t.start_time.startsWith(taskDate))
    .map((t) => ({ start: new Date(t.start_time).getTime(), end: new Date(t.end_time).getTime() }))
    .sort((a, b) => a.start - b.start);

  // Try slot ending at preferredTime (task ends exactly at preferred)
  const slotEnd = preferred;
  const slotStart = slotEnd - durationMs;
  if (slotStart < dayStart) return null;
  const overlaps = sameDayTasks.some((t) => slotStart < t.end && slotEnd > t.start);
  if (!overlaps) return { start_time: new Date(slotStart).toISOString(), end_time: new Date(slotEnd).toISOString() };

  // Try to fit before the last task that ends before or at preferred
  for (let i = sameDayTasks.length - 1; i >= 0; i--) {
    const gapEnd = sameDayTasks[i].start;
    const gapStart = gapEnd - durationMs;
    if (gapStart >= dayStart && gapEnd <= preferred) {
      const overlapsGap = sameDayTasks.some((t) => gapStart < t.end && gapEnd > t.start);
      if (!overlapsGap)
        return { start_time: new Date(gapStart).toISOString(), end_time: new Date(gapEnd).toISOString() };
    }
  }
  return null;
}
