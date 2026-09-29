import { JournalEntryType, OperationalCostType, UnitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DO_REVENUE_STATUSES } from "@/lib/operations/do-status";
import { syncUnitBreakdownStatus } from "@/lib/breakdown/unit-status";
import {
  addMonths,
  dateOnlyRange,
  diffDays,
  formatDateOnly,
  monthEnd,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dates";
import { computeDoHpp, DO_HPP_INCLUDE } from "@/lib/finance/do-hpp";
import type { MonthlyFinancePoint } from "@/components/dashboard/revenue-hpp-chart";
import type { UnitPerformanceRow } from "@/components/dashboard/unit-performance-table";

export type DashboardData = {
  from: string;
  to: string;
  /** Calendar days in the range (inclusive) */
  days: number;
  unitStatus: {
    total: number;
    running: number;
    standby: number;
    breakdown: number;
    maintenance: number;
  };
  produksi: {
    totalRitase: number;
    totalTonase: number;
    avgTonasePerRit: number;
    totalKm: number;
    /** Units with ≥ 1 verified DO in the range */
    activeUnits: number;
    /** Distinct (unit, date) pairs with a verified DO */
    unitDays: number;
    kmPerUnit: number;
    tonPerKm: number;
    ritasePerUnit: number;
    kmPerUnitDay: number;
    ritasePerUnitDay: number;
    solarLiters: number;
  };
  finansialHariIni: {
    revenue: number;
    hpp: number;
    profit: number;
    profitPerTon: number;
    profitPerUnit: number;
    profitPerUnitDay: number;
    hppPerTon: number;
    /** Real money out on the date: uang jalan + solar/biaya lain + breakdown + jurnal keluar */
    cashOut: number;
    cashOutBreakdown: {
      uangJalan: number;
      opsCost: number;
      breakdown: number;
      journal: number;
    };
    /** Customer payments received on the date */
    cashIn: number;
  };
  monthlyChart: MonthlyFinancePoint[];
  unitPerformance: UnitPerformanceRow[];
};

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export async function getOwnerDashboardData(
  /** Inclusive "YYYY-MM-DD" (WIB) range; defaults to today */
  range: { from?: string; to?: string } = {}
): Promise<DashboardData> {
  await syncUnitBreakdownStatus();
  const to = range.to ?? todayDateOnly();
  const from = range.from && range.from <= to ? range.from : to;
  const day = dateOnlyRange(from, to);
  const chartStart = addMonths(to, -5);

  const [units, todayDos, uangJalan, opsCosts, breakdown, journalOut, payments, chartDos] =
    await Promise.all([
      prisma.masterUnit.findMany({ select: { id: true, status: true } }),
      prisma.deliveryOrder.findMany({
        where: { date: day, status: { in: DO_REVENUE_STATUSES }, netto: { gt: 0 } },
        include: DO_HPP_INCLUDE,
      }),
      prisma.deliveryOrder.aggregate({ where: { date: day }, _sum: { uangJalan: true } }),
      prisma.operationalCost.findMany({
        where: { date: day },
        select: { unitId: true, costType: true, amount: true, volume: true },
      }),
      prisma.breakdownHistory.aggregate({ where: { date: day }, _sum: { maintenanceCost: true } }),
      prisma.hppJournalEntry.aggregate({
        where: { date: day, entryType: JournalEntryType.CASH_OUT },
        _sum: { amount: true },
      }),
      prisma.invoicePayment.aggregate({ where: { date: day }, _sum: { amount: true } }),
      prisma.deliveryOrder.findMany({
        where: {
          date: dateOnlyRange(chartStart, monthEnd(to)),
          status: { in: DO_REVENUE_STATUSES },
          netto: { gt: 0 },
        },
        include: DO_HPP_INCLUDE,
      }),
    ]);

  const unitStatus = {
    total: units.length,
    running: units.filter((u) => u.status === UnitStatus.RUNNING).length,
    standby: units.filter((u) => u.status === UnitStatus.STANDBY).length,
    breakdown: units.filter((u) => u.status === UnitStatus.BREAKDOWN).length,
    maintenance: units.filter((u) => u.status === UnitStatus.MAINTENANCE).length,
  };

  const litersByUnit = new Map<string, number>();
  let solarLiters = 0;
  for (const c of opsCosts) {
    if (c.costType !== OperationalCostType.SOLAR) continue;
    solarLiters += c.volume ?? 0;
    litersByUnit.set(c.unitId, (litersByUnit.get(c.unitId) ?? 0) + (c.volume ?? 0));
  }

  type Acc = UnitPerformanceRow & { solarCost: number; unitId: string; dates: Set<string> };
  const unitMap = new Map<string, Acc>();
  let revenue = 0;
  let hpp = 0;
  let totalTonase = 0;
  let totalKm = 0;
  const todayHpp = computeDoHpp(todayDos);
  for (const op of todayDos) {
    const r = todayHpp.get(op.id)!;
    const netto = op.netto ?? 0;
    const km = op.kmHauling ?? 0;
    revenue += r.revenue;
    hpp += r.totalHpp;
    totalTonase += netto;
    totalKm += km;
    const row = unitMap.get(op.unitId) ?? {
      unitId: op.unitId,
      unitNumber: op.unit.unitNumber,
      ritase: 0,
      tonase: 0,
      km: 0,
      solarLiters: 0,
      tonPerKm: 0,
      fuelCostPerTon: 0,
      revenue: 0,
      hpp: 0,
      hppPerTon: 0,
      profitPerUnit: 0,
      hariJalan: 0,
      solarCost: 0,
      dates: new Set<string>(),
    };
    row.dates.add(formatDateOnly(op.date));
    row.ritase += 1;
    row.tonase += netto;
    row.km += km;
    row.revenue += r.revenue;
    row.hpp += r.totalHpp;
    row.profitPerUnit += r.grossProfit;
    row.solarCost += r.solarActual;
    unitMap.set(op.unitId, row);
  }

  const unitPerformance: UnitPerformanceRow[] = Array.from(unitMap.values())
    .map(({ solarCost, unitId, dates, ...row }) => ({
      ...row,
      hariJalan: dates.size,
      solarLiters: litersByUnit.get(unitId) ?? 0,
      tonPerKm: div(row.tonase, row.km),
      fuelCostPerTon: div(solarCost, row.tonase),
      hppPerTon: div(row.hpp, row.tonase),
    }))
    .sort((a, b) => b.profitPerUnit - a.profitPerUnit);

  const totalRitase = todayDos.length;
  const activeUnits = unitMap.size;
  const unitDays = unitPerformance.reduce((s, r) => s + r.hariJalan, 0);
  const profit = revenue - hpp;

  const cashOutBreakdown = {
    uangJalan: uangJalan._sum.uangJalan ?? 0,
    opsCost: opsCosts.reduce((s, c) => s + c.amount, 0),
    breakdown: breakdown._sum.maintenanceCost ?? 0,
    journal: journalOut._sum.amount ?? 0,
  };

  // ── 6-month chart ──
  const chartHpp = computeDoHpp(chartDos);
  const byMonth = new Map<string, { revenue: number; hpp: number }>();
  for (const op of chartDos) {
    const key = formatDateOnly(op.date).slice(0, 7);
    const r = chartHpp.get(op.id)!;
    const m = byMonth.get(key) ?? { revenue: 0, hpp: 0 };
    m.revenue += r.revenue;
    m.hpp += r.totalHpp;
    byMonth.set(key, m);
  }
  const monthlyChart: MonthlyFinancePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = addMonths(to, -i);
    const m = byMonth.get(start.slice(0, 7)) ?? { revenue: 0, hpp: 0 };
    monthlyChart.push({
      month: parseDateOnly(start).toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      revenue: m.revenue,
      hpp: m.hpp,
      profit: m.revenue - m.hpp,
    });
  }

  return {
    from,
    to,
    days: diffDays(from, to) + 1,
    unitStatus,
    produksi: {
      totalRitase,
      totalTonase,
      avgTonasePerRit: div(totalTonase, totalRitase),
      totalKm,
      activeUnits,
      unitDays,
      kmPerUnit: div(totalKm, activeUnits),
      tonPerKm: div(totalTonase, totalKm),
      ritasePerUnit: div(totalRitase, activeUnits),
      kmPerUnitDay: div(totalKm, unitDays),
      ritasePerUnitDay: div(totalRitase, unitDays),
      solarLiters,
    },
    finansialHariIni: {
      revenue,
      hpp,
      profit,
      profitPerTon: div(profit, totalTonase),
      profitPerUnit: div(profit, activeUnits),
      profitPerUnitDay: div(profit, unitDays),
      hppPerTon: div(hpp, totalTonase),
      cashOut:
        cashOutBreakdown.uangJalan +
        cashOutBreakdown.opsCost +
        cashOutBreakdown.breakdown +
        cashOutBreakdown.journal,
      cashOutBreakdown,
      cashIn: payments._sum.amount ?? 0,
    },
    monthlyChart,
    unitPerformance,
  };
}
