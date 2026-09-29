/**
 * Business dates are Indonesian (WIB). Prisma `@db.Date` columns keep only the
 * UTC calendar date, so a date-only value must be stored as UTC midnight —
 * `new Date("2026-09-28T00:00:00")` in UTC+7 would be saved as 2026-09-27.
 */
export const APP_TIMEZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). Throws if invalid. */
export function parseDateOnly(value: string): Date {
  const v = value.trim().slice(0, 10);
  if (!DATE_RE.test(v)) throw new Error("Tanggal tidak valid");
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  return d;
}

/** Like parseDateOnly but returns null instead of throwing. */
export function tryParseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    return parseDateOnly(value);
  } catch {
    return null;
  }
}

/** @db.Date value → "YYYY-MM-DD" */
export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar date of an instant in WIB → "YYYY-MM-DD" */
export function toWibDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Today in WIB → "YYYY-MM-DD" (works on server and in the browser) */
export function todayDateOnly(): string {
  return toWibDateString(new Date());
}

/**
 * `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") is WIB wall-clock
 * time. Parse it with an explicit offset so the server timezone doesn't matter.
 */
export function parseWibDateTime(value: string): Date {
  const v = value.trim();
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(v);
  const d = new Date(hasOffset ? v : `${v.length === 16 ? `${v}:00` : v}${WIB_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error("Waktu tidak valid");
  return d;
}

/** Instant → WIB "YYYY-MM-DDTHH:mm" for datetime-local inputs */
export function toWibDateTimeLocal(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function addDays(date: string, days: number): string {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); negative if to < from. */
export function diffDays(from: string, to: string): number {
  return Math.round(
    (parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / 86_400_000
  );
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: string): string {
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  return formatDateOnly(new Date(Date.UTC(y, m, 0)));
}

/** Shift a "YYYY-MM-DD" by whole months, returning the 1st of that month. */
export function addMonths(date: string, months: number): string {
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  return formatDateOnly(new Date(Date.UTC(y, m - 1 + months, 1)));
}

/** Prisma filter for a @db.Date column between two inclusive dates. */
export function dateOnlyRange(from: string, to: string) {
  return { gte: parseDateOnly(from), lte: parseDateOnly(to) };
}

/** "2026-09" style month label in Indonesian, e.g. "September 2026" */
export function monthLabel(date: string): string {
  return parseDateOnly(monthStart(date)).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
