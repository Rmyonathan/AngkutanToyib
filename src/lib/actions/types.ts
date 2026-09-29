export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return value;
}

export function optionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
