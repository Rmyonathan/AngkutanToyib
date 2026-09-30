/** Format integer with Indonesian thousand separators (1.000.000). */
export function formatIdInteger(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** Parse user input with dots as thousands (and optional comma decimals). */
export function parseIdNumber(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
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
  const fromId = parseIdNumber(raw);
  if (fromId !== 0) return fromId;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
