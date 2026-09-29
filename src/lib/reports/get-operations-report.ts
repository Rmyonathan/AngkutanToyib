import { OperationalCostType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DO_REVENUE_STATUSES,
  DO_STATUS_LABEL,
} from "@/lib/operations/do-status";
import { dateOnlyRange, formatDateOnly } from "@/lib/dates";

export type ReportFilters = {
  /** "YYYY-MM-DD" inclusive */
  from: string;
  to: string;
  unitId?: string | null;
  customerId?: string | null;
};

export type ReportDoRow = {
  id: string;
  internalTripId: string;
  date: string;
  unitNumber: string;
  driverName: string;
  customerName: string | null;
  tripName: string | null;
  ticketNumber: string | null;
  netto: number;
  ratePerTon: number;
  revenue: number;
  uangJalan: number;
  solarCost: number;
  solarLiters: number;
  otherCost: number;
  ongkosan: number;
  untung: number;
  status: string;
};

export type ReportUnitRow = {
  unitId: string;
  unitNumber: string;
  ritase: number;
  tonase: number;
  revenue: number;
  uangJalan: number;
  solarCost: number;
  solarLiters: number;
  otherCost: number;
  /** Solar/biaya lain yang tidak terhubung ke DO manapun */
  unlinkedCost: number;
  ongkosan: number;
  untung: number;
};

export type ReportCustomerRow = {
  customerId: string | null;
  customerName: string;
  ritase: number;
  tonase: number;
  revenue: number;
  avgRate: number;
};

export type ReportDayRow = {
  date: string;
  ritase: number;
  tonase: number;
  revenue: number;
  ongkosan: number;
  untung: number;
};

export type OperationsReport = {
  period: { from: string; to: string };
  filters: { unitId: string | null; customerId: string | null };
  summary: {
    ritase: number;
    tonase: number;
    avgNetto: number;
    revenue: number;
    uangJalan: number;
    solarCost: number;
    solarLiters: number;
    otherCost: number;
    unlinkedCost: number;
    ongkosan: number;
    untung: number;
    marginPercent: number;
    pendingTrips: number;
  };
  rows: ReportDoRow[];
  perUnit: ReportUnitRow[];
  perCustomer: ReportCustomerRow[];
  perDay: ReportDayRow[];
};

const iso = formatDateOnly;
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function getOperationsReport(
  filters: ReportFilters
): Promise<OperationsReport> {
  const range = dateOnlyRange(filters.from, filters.to);
  const unitId = filters.unitId || null;
  const customerId = filters.customerId || null;

  const doWhere: Prisma.DeliveryOrderWhereInput = {
    date: range,
    ...(unitId ? { unitId } : {}),
    ...(customerId ? { customerId } : {}),
  };

  const [dos, unlinkedCosts, pendingTrips] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where: { ...doWhere, status: { in: DO_REVENUE_STATUSES } },
      include: {
        unit: { select: { id: true, unitNumber: true } },
        driver: { select: { name: true } },
        customer: { select: { id: true, customerName: true } },
        customerTrip: { select: { name: true } },
        operationalCosts: {
          select: { costType: true, amount: true, volume: true },
        },
      },
      orderBy: [{ date: "asc" }, { internalTripId: "asc" }],
    }),
    // Costs in period not attached to any DO (e.g. solar filled outside a trip).
    // Only meaningful per unit — skipped when filtering by customer.
    customerId
      ? Promise.resolve([])
      : prisma.operationalCost.findMany({
          where: {
            date: range,
            deliveryOrderId: null,
            ...(unitId ? { unitId } : {}),
          },
          select: {
            unitId: true,
            amount: true,
            unit: { select: { unitNumber: true } },
          },
        }),
    prisma.deliveryOrder.count({
      where: { ...doWhere, status: { notIn: DO_REVENUE_STATUSES } },
    }),
  ]);

  const rows: ReportDoRow[] = dos.map((d) => {
    const netto = d.netto ?? 0;
    const rate = d.ratePerTon;
    const revenue = netto * rate;
    let solarCost = 0;
    let solarLiters = 0;
    let otherCost = 0;
    for (const c of d.operationalCosts) {
      if (c.costType === OperationalCostType.SOLAR) {
        solarCost += c.amount;
        solarLiters += c.volume ?? 0;
      } else {
        otherCost += c.amount;
      }
    }
    const ongkosan = d.uangJalan + solarCost + otherCost;
    return {
      id: d.id,
      internalTripId: d.internalTripId,
      date: iso(d.date),
      unitNumber: d.unit.unitNumber,
      driverName: d.driver.name,
      customerName: d.customer?.customerName ?? null,
      ticketNumber: d.ticketNumber,
      tripName: d.customerTrip?.name ?? null,
      netto,
      ratePerTon: rate,
      revenue,
      uangJalan: d.uangJalan,
      solarCost,
      solarLiters,
      otherCost,
      ongkosan,
      untung: revenue - ongkosan,
      status: DO_STATUS_LABEL[d.status],
    };
  });

  // ── per unit ──
  const unitMap = new Map<string, ReportUnitRow>();
  const ensureUnit = (id: string, unitNumber: string) => {
    let u = unitMap.get(id);
    if (!u) {
      u = {
        unitId: id,
        unitNumber,
        ritase: 0,
        tonase: 0,
        revenue: 0,
        uangJalan: 0,
        solarCost: 0,
        solarLiters: 0,
        otherCost: 0,
        unlinkedCost: 0,
        ongkosan: 0,
        untung: 0,
      };
      unitMap.set(id, u);
    }
    return u;
  };
  dos.forEach((d, i) => {
    const row = rows[i];
    const u = ensureUnit(d.unit.id, d.unit.unitNumber);
    u.ritase += 1;
    u.tonase += row.netto;
    u.revenue += row.revenue;
    u.uangJalan += row.uangJalan;
    u.solarCost += row.solarCost;
    u.solarLiters += row.solarLiters;
    u.otherCost += row.otherCost;
  });
  for (const c of unlinkedCosts) {
    const u = ensureUnit(c.unitId, c.unit.unitNumber);
    u.unlinkedCost += c.amount;
  }
  const perUnit = Array.from(unitMap.values())
    .map((u) => {
      const ongkosan = u.uangJalan + u.solarCost + u.otherCost + u.unlinkedCost;
      return { ...u, ongkosan, untung: u.revenue - ongkosan };
    })
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));

  // ── per customer ──
  const custMap = new Map<string, ReportCustomerRow>();
  dos.forEach((d, i) => {
    const row = rows[i];
    const key = d.customer?.id ?? "__none__";
    let c = custMap.get(key);
    if (!c) {
      c = {
        customerId: d.customer?.id ?? null,
        customerName: d.customer?.customerName ?? "Tanpa customer",
        ritase: 0,
        tonase: 0,
        revenue: 0,
        avgRate: 0,
      };
      custMap.set(key, c);
    }
    c.ritase += 1;
    c.tonase += row.netto;
    c.revenue += row.revenue;
  });
  const perCustomer = Array.from(custMap.values())
    .map((c) => ({ ...c, avgRate: c.tonase > 0 ? c.revenue / c.tonase : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── per day ──
  const dayMap = new Map<string, ReportDayRow>();
  for (const row of rows) {
    let d = dayMap.get(row.date);
    if (!d) {
      d = {
        date: row.date,
        ritase: 0,
        tonase: 0,
        revenue: 0,
        ongkosan: 0,
        untung: 0,
      };
      dayMap.set(row.date, d);
    }
    d.ritase += 1;
    d.tonase += row.netto;
    d.revenue += row.revenue;
    d.ongkosan += row.ongkosan;
    d.untung += row.untung;
  }
  const perDay = Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // ── summary ──
  const sum = <T,>(arr: T[], f: (x: T) => number) =>
    arr.reduce((s, x) => s + f(x), 0);
  const ritase = rows.length;
  const tonase = r2(sum(rows, (r) => r.netto));
  const revenue = sum(rows, (r) => r.revenue);
  const uangJalan = sum(rows, (r) => r.uangJalan);
  const solarCost = sum(rows, (r) => r.solarCost);
  const solarLiters = sum(rows, (r) => r.solarLiters);
  const otherCost = sum(rows, (r) => r.otherCost);
  const unlinkedCost = sum(unlinkedCosts, (c) => c.amount);
  const ongkosan = uangJalan + solarCost + otherCost + unlinkedCost;
  const untung = revenue - ongkosan;

  return {
    period: { from: filters.from, to: filters.to },
    filters: { unitId, customerId },
    summary: {
      ritase,
      tonase,
      avgNetto: ritase > 0 ? tonase / ritase : 0,
      revenue,
      uangJalan,
      solarCost,
      solarLiters,
      otherCost,
      unlinkedCost,
      ongkosan,
      untung,
      marginPercent: revenue > 0 ? (untung / revenue) * 100 : 0,
      pendingTrips,
    },
    rows,
    perUnit,
    perCustomer,
    perDay,
  };
}
