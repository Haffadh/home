/**
 * Formats a task's time block for display: start_time – end_time · duration
 */
export function formatTaskTimeRange(
  startTime: string,
  endTime: string,
  durationMinutes?: number
): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startStr = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endStr = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const computed = durationMinutes ?? Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  const dur = Math.max(0, computed);
  return `${startStr} – ${endStr} · ${dur}m`;
}

/** Time-only display for an ISO string (e.g. created_at). */
export function formatTimeOnly(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}
