import { OperationalCostType, type Prisma } from "@prisma/client";
import { calculateDriverCost } from "@/lib/calculations/hpp";
import { formatDateOnly } from "@/lib/dates";

/** Gaji bulanan supir dibagi rata ke hari kerja ini */
const DRIVER_WORK_DAYS_PER_MONTH = 25;

export const DO_HPP_INCLUDE = {
  unit: true,
  driver: true,
  customer: true,
  operationalCosts: { select: { costType: true, amount: true } },
} satisfies Prisma.DeliveryOrderInclude;

export type DoWithHppRelations = Prisma.DeliveryOrderGetPayload<{
  include: typeof DO_HPP_INCLUDE;
}>;

export type DoHppResult = {
  revenue: number;
  /** Solar aktual (nota solar terverifikasi) */
  solarActual: number;
  /** Biaya lain aktual (tol, parkir, dll.) */
  otherActual: number;
  uangJalan: number;
  /** Gaji supir dari Master Driver */
  driverCost: number;
  totalHpp: number;
  grossProfit: number;
  profitPerTon: number;
  marginPercent: number;
};

/**
 * Biaya per DO = uang jalan + solar + biaya lain (yang diverifikasi dari foto
 * supir) + gaji supir (Master Driver). HPP Settings (ban, maintenance, cicilan,
 * depresiasi, moving) sengaja tidak ikut dihitung.
 *
 * Gaji harian/bulanan dibagi rata ke semua DO supir tsb di tanggal yang sama,
 * sehingga 2 rit/hari tidak menghitung 2× gaji harian.
 */
export function computeDoHpp(dos: DoWithHppRelations[]): Map<string, DoHppResult> {
  const perDriverDay = new Map<string, number>();
  const dayKey = (d: DoWithHppRelations) =>
    `${d.driverId}|${formatDateOnly(d.date)}`;
  for (const d of dos) {
    perDriverDay.set(dayKey(d), (perDriverDay.get(dayKey(d)) ?? 0) + 1);
  }

  const out = new Map<string, DoHppResult>();
  for (const op of dos) {
    const netto = op.netto ?? 0;
    const share = 1 / (perDriverDay.get(dayKey(op)) ?? 1);
    const revenue = netto * (op.ratePerTon || op.customer?.ratePerTon || 0);
    const driverCost = calculateDriverCost(
      netto,
      {
        salarySystem: op.driver.salarySystem,
        driverRatePerTon: op.driver.driverRatePerTon,
        monthlySalary: op.driver.monthlySalary,
        dailySalary: op.driver.dailySalary,
      },
      DRIVER_WORK_DAYS_PER_MONTH,
      share
    );

    let solarActual = 0;
    let otherActual = 0;
    for (const c of op.operationalCosts) {
      if (c.costType === OperationalCostType.SOLAR) solarActual += c.amount;
      else otherActual += c.amount;
    }
    const totalHpp = op.uangJalan + solarActual + otherActual + driverCost;
    const grossProfit = revenue - totalHpp;

    out.set(op.id, {
      revenue,
      solarActual,
      otherActual,
      uangJalan: op.uangJalan,
      driverCost,
      totalHpp,
      grossProfit,
      profitPerTon: netto > 0 ? grossProfit / netto : 0,
      marginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    });
  }
  return out;
}
