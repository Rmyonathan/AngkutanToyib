/** Format integer with Indonesian thousand separators (1.000.000). */
export function formatIdInteger(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/**
 * Parse user input:
 * - `30,5` / `30,57` (koma desimal)
 * - `30.5` / `30.57` (titik desimal — keyboard HP)
 * - `1.234,56` (ribuan titik + desimal koma)
 */
export function parseIdNumber(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  if (trimmed.includes(",")) {
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      const n = Number(`${parts[0]}.${parts[1]}`);
      return Number.isFinite(n) ? n : 0;
    }
    const normalized = trimmed.replace(/\./g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/** Format decimal tonase / liter (12,5). */
export function formatIdDecimal(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function parseIdDecimal(input: string): number {
  return parseIdNumber(input);
}

/** Parse form string (plain or formatted) to number. */
export function fieldToNumber(raw: string): number {
  if (!raw.trim()) return 0;
  return parseIdNumber(raw);
}

/** Allow typing partial tonase (30, / 30. / 30,57). */
export function sanitizeDecimalTyping(raw: string, maxDecimals: number): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const comma = s.indexOf(",");
  const dot = s.indexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma < dot) s = s.replace(/\./g, "");
    else s = s.replace(/,/g, "");
  }
  const sep = s.includes(",") ? "," : s.includes(".") ? "." : null;
  if (sep) {
    const i = s.indexOf(sep);
    const head = s.slice(0, i + 1);
    const tail = s.slice(i + 1).replace(/[.,]/g, "").slice(0, maxDecimals);
    s = head + tail;
  }
  return s;
}
