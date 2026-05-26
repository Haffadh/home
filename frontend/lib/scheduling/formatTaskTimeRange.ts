/**
 * Formats a task's time block for display: start_time – end_time · duration.
 * Defensive against "Invalid Date" on iOS Safari (strict WebKit parser).
 */

import { safeDate } from "./safeDate";

export function formatTaskTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  durationMinutes?: number,
  /** Optional task date — used to anchor time-only values like "14:30:00". */
  date?: string | null
): string {
  const start = safeDate(startTime, date);
  const end = safeDate(endTime, date);

  if (!start && !end) {
    return durationMinutes ? `${durationMinutes}m` : "";
  }

  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });

  const startStr = start ? fmt(start) : "—";
  const endStr = end
    ? fmt(end)
    : start && durationMinutes
      ? fmt(new Date(start.getTime() + durationMinutes * 60_000))
      : "—";

  const computed = durationMinutes ??
    (start && end ? Math.round((end.getTime() - start.getTime()) / 60_000) : 0);
  const dur = Math.max(0, computed);
  return `${startStr} – ${endStr} · ${dur}m`;
}

/** Time-only display for an ISO string (e.g. created_at). */
export function formatTimeOnly(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}
