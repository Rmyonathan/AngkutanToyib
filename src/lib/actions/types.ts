import { parseIdNumber } from "@/lib/numbers";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return value;
}

export function optionalNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  if (typeof value === "string") {
    const n = parseIdNumber(value);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function requiredNumber(value: unknown): number {
  if (typeof value === "string") return parseIdNumber(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
