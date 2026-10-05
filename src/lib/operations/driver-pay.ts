import { SalarySystem } from "@prisma/client";
import { formatRupiah } from "@/lib/utils";
import {
  DO_DRIVER_PAY_MODE,
  type DoDriverPayMode,
} from "@/lib/operations/driver-pay-mode";

export type { DoDriverPayMode } from "@/lib/operations/driver-pay-mode";
export { DRIVER_PAY_MODE_LABEL } from "@/lib/operations/driver-pay-mode";

const WORK_DAYS = 25;

export type MasterDriverPayProfile = {
  salarySystem: SalarySystem;
  driverRatePerTon: number;
  monthlySalary: number | null;
  dailySalary: number | null;
};

export type DriverPayDefaults = {
  mode: DoDriverPayMode;
  amount: number;
  hint: string;
};

/** Default gaji dari Master Driver → placeholder / reset di form DO */
export function masterDriverPayDefaults(
  driver: MasterDriverPayProfile
): DriverPayDefaults {
  switch (driver.salarySystem) {
    case SalarySystem.PER_TON:
      return {
        mode: DO_DRIVER_PAY_MODE.PER_TON,
        amount: driver.driverRatePerTon,
        hint: `${formatRupiah(driver.driverRatePerTon)} / ton (master)`,
      };
    case SalarySystem.DAILY:
      return {
        mode: DO_DRIVER_PAY_MODE.PER_TRIP,
        amount: driver.dailySalary ?? 0,
        hint: `${formatRupiah(driver.dailySalary ?? 0)} / trip (master harian)`,
      };
    case SalarySystem.MONTHLY:
      return {
        mode: DO_DRIVER_PAY_MODE.PER_TRIP,
        amount: Math.round((driver.monthlySalary ?? 0) / WORK_DAYS),
        hint: `${formatRupiah(Math.round((driver.monthlySalary ?? 0) / WORK_DAYS))} / trip (≈ gaji bulanan ÷ ${WORK_DAYS})`,
      };
    default:
      return {
        mode: DO_DRIVER_PAY_MODE.PER_TON,
        amount: driver.driverRatePerTon,
        hint: `${formatRupiah(driver.driverRatePerTon)} / ton (master)`,
      };
  }
}

export function computeDoDriverPay(
  netto: number,
  mode: DoDriverPayMode,
  amount: number,
  master?: MasterDriverPayProfile,
  dailyShare = 1
): number {
  if (amount > 0) {
    return mode === DO_DRIVER_PAY_MODE.PER_TRIP
      ? amount
      : netto * amount;
  }
  if (!master) return 0;
  const d = masterDriverPayDefaults(master);
  if (d.mode === DO_DRIVER_PAY_MODE.PER_TRIP) {
    return d.amount;
  }
  return netto * d.amount;
}

/** Legacy DO tanpa amount tersimpan — pakai master + pembagian harian */
export function computeDoDriverPayLegacy(
  netto: number,
  master: MasterDriverPayProfile,
  dailyShare: number
): number {
  switch (master.salarySystem) {
    case SalarySystem.PER_TON:
      return netto * master.driverRatePerTon;
    case SalarySystem.MONTHLY:
      return ((master.monthlySalary ?? 0) / WORK_DAYS) * dailyShare;
    case SalarySystem.DAILY:
      return (master.dailySalary ?? 0) * dailyShare;
    default:
      return netto * master.driverRatePerTon;
  }
}

