/** Nilai enum Prisma — const lokal agar aman di client (tanpa @prisma/client runtime). */
export const DO_DRIVER_PAY_MODE = {
  PER_TON: "PER_TON",
  PER_TRIP: "PER_TRIP",
} as const;

export type DoDriverPayMode =
  (typeof DO_DRIVER_PAY_MODE)[keyof typeof DO_DRIVER_PAY_MODE];

export const DRIVER_PAY_MODE_LABEL: Record<DoDriverPayMode, string> = {
  PER_TON: "Per ton",
  PER_TRIP: "Per trip (flat)",
};

export const DO_DRIVER_PAY_MODE_VALUES = [
  DO_DRIVER_PAY_MODE.PER_TON,
  DO_DRIVER_PAY_MODE.PER_TRIP,
] as const;
