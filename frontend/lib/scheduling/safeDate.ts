/**
 * iOS Safari is strict about date parsing — `new Date("14:30:00")` and
 * `new Date("14:30")` return "Invalid Date" on WebKit (Chrome happens to parse
 * them as today). Tasks in Supabase can have `start_time` stored as "HH:MM:SS"
 * (time column) rather than a full ISO timestamp. This helper produces a
 * cross-browser-safe Date, combining a time-only value with its date when
 * needed.
 *
 * Accepts:
 *   "2026-04-18T13:00:00"  → parsed directly
 *   "2026-04-18T13:00:00Z" → parsed directly
 *   "13:00"                → treated as today (or `date` if provided)
 *   "13:00:00"             → treated as today (or `date` if provided)
 *   null / undefined       → null
 *
 * Returns null when the input cannot be parsed.
 */
export function safeDate(value: string | null | undefined, date?: string | null): Date | null {
  if (!value) return null;

  const s = String(value).trim();
  if (!s) return null;

  // HH:MM or HH:MM:SS — combine with provided date or today
  const timeOnlyMatch = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const hh = timeOnlyMatch[1].padStart(2, "0");
    const mm = timeOnlyMatch[2];
    const ss = timeOnlyMatch[3] ?? "00";
    const datePart = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
    const d = new Date(`${datePart}T${hh}:${mm}:${ss}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Otherwise try direct parse — but normalize space to T for Safari
  const normalized = s.includes("T") || s.includes("Z") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Safe version of .toISOString() — returns empty string on invalid input. */
export function safeIso(value: string | null | undefined, date?: string | null): string {
  const d = safeDate(value, date);
  return d ? d.toISOString() : "";
}
