import {
  JournalCategory,
  JournalEntryType,
  OperationalCostType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeDoHpp, DO_HPP_INCLUDE } from "@/lib/finance/do-hpp";
import { DO_REVENUE_STATUSES } from "@/lib/operations/do-status";
import {
  dateOnlyRange,
  formatDateOnly,
  monthLabel,
  monthStart,
  todayDateOnly,
} from "@/lib/dates";

/**
 * Two views of the same month:
 *
 * 1. Laba-rugi (accrual) — Buku Harian, Profitabilitas
 *    Revenue diakui saat DO VERIFIED (tonase × rate), walau customer bayar tempo.
 *    Biaya = biaya aktual DO (uang jalan, solar & biaya lain yang diverifikasi, gaji supir)
 *          + biaya ops tanpa DO + breakdown + jurnal kas keluar.
 *    HPP Settings (ban, maintenance, cicilan, depresiasi, moving) tidak dipakai di sini.
 *
 * 2. Kas (cash basis) — Kas Keseluruhan
 *    Masuk  = pembayaran invoice yang dicatat + jurnal kas masuk.
 *    Keluar = uang jalan + solar/biaya lain terverifikasi + breakdown + jurnal kas keluar.
 */

export type FinancialHppRow = {
  id: string;
  date: string;
  unitNumber: string;
  driverName: string;
  customerName: string;
  ritase: number;
  tonase: number;
  revenue: number;
  /** Solar aktual (nota solar terverifikasi yang terhubung ke DO) */
  solarCost: number;
  driverCost: number;
  /** Uang jalan trip (aktual) */
  uangJalan: number;
  /** Biaya lain terverifikasi yang terhubung ke DO (tol, parkir, dll.) */
  otherOpsCost: number;
  totalHpp: number;
  grossProfit: number;
  profitPerTon: number;
  marginPercent: number;
};

export type LedgerSource =
  | "PEMBAYARAN"
  | "UANG_JALAN"
  | "BIAYA_OPS"
  | "BREAKDOWN"
  | "JOURNAL";

export type JournalLedgerRow = {
  id: string;
  date: string;
  entryType: JournalEntryType;
  category: JournalCategory;
  description: string;
  amount: number;
  unitNumber: string | null;
  notes: string | null;
  createdByName: string | null;
  /** Only JOURNAL rows are manual (deletable); others are generated */
  source: LedgerSource;
  /** Link to the source document (trip / invoice) */
  href?: string;
};

export type FinancialHppSummary = {
  revenue: number;
  totalHpp: number;
  grossProfit: number;
  marginPercent: number;
  totalTonase: number;
  profitPerTon: number;
  solarCost: number;
  driverCost: number;
  otherHpp: number;
  /** Manual CASH_OUT from journal */
  journalOut: number;
  /** Manual CASH_IN from journal */
  journalIn: number;
  /** Accrual revenue from verified DOs (netto × rate) — NOT cash */
  opsRevenue: number;
  /** Maintenance cost from BreakdownHistory — kas keluar */
  breakdownMaintenance: number;
  /** Customer payments received (invoice payments) — kas masuk */
  paymentsIn: number;
  /** PPh 23 withheld on those payments (not cash) */
  paymentsWithholding: number;
  /** Uang jalan of all trips dated in period — kas keluar */
  uangJalanOut: number;
  /** Verified Solar / Biaya Lain (OperationalCost) — kas keluar */
  opsCostOut: number;
  kasIn: number;
  kasOut: number;
  netKas: number;
};

export type FinancialHppData = {
  periodLabel: string;
  from: string;
  to: string;
  summary: FinancialHppSummary;
  rows: FinancialHppRow[];
  journals: JournalLedgerRow[];
  units: { id: string; unitNumber: string }[];
  byUnit: UnitProfitSummary[];
};

export type UnitProfitSummary = {
  unitNumber: string;
  revenue: number;
  totalHpp: number;
  grossProfit: number;
  tonase: number;
  marginPercent: number;
  solarCost: number;
  driverCost: number;
  uangJalan: number;
  /** Biaya lain aktual (DO-linked + tanpa trip) */
  otherOpsCost: number;
  /** Maintenance from BreakdownHistory */
  breakdownCost: number;
  /** Manual CASH_OUT journal assigned to unit */
  journalOut: number;
  /** Manual CASH_IN journal assigned to unit */
  journalIn: number;
};

type UnitAgg = Omit<UnitProfitSummary, "marginPercent">;

function emptyUnitAgg(unitNumber: string): UnitAgg {
  return {
    unitNumber,
    revenue: 0,
    totalHpp: 0,
    grossProfit: 0,
    tonase: 0,
    solarCost: 0,
    driverCost: 0,
    uangJalan: 0,
    otherOpsCost: 0,
    breakdownCost: 0,
    journalOut: 0,
    journalIn: 0,
  };
}

function costCategory(t: OperationalCostType): JournalCategory {
  switch (t) {
    case OperationalCostType.SOLAR:
      return JournalCategory.SOLAR;
    case OperationalCostType.MAINTENANCE:
      return JournalCategory.MAINTENANCE;
    default:
      return JournalCategory.BIAYA_LAIN;
  }
}

export async function getFinancialHppData(
  /** "YYYY-MM-DD" (WIB); period = 1st of that month → this date */
  referenceDate: string = todayDateOnly()
): Promise<FinancialHppData> {
  const from = monthStart(referenceDate);
  const to = referenceDate;
  const range = dateOnlyRange(from, to);

  const [ops, journalRows, breakdownRows, units, opsCosts, tripsWithUj, payments] =
    await Promise.all([
      prisma.deliveryOrder.findMany({
        where: {
          date: range,
          status: { in: DO_REVENUE_STATUSES },
          netto: { not: null, gt: 0 },
        },
        include: DO_HPP_INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.hppJournalEntry.findMany({
        where: { date: range },
        include: {
          unit: { select: { unitNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.breakdownHistory.findMany({
        where: { date: range, maintenanceCost: { gt: 0 } },
        include: { unit: { select: { unitNumber: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.masterUnit.findMany({
        select: { id: true, unitNumber: true },
        orderBy: { unitNumber: "asc" },
      }),
      prisma.operationalCost.findMany({
        where: { date: range },
        include: {
          unit: { select: { unitNumber: true } },
          driver: { select: { name: true } },
          deliveryOrder: { select: { id: true, internalTripId: true, status: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.deliveryOrder.findMany({
        where: { date: range, uangJalan: { gt: 0 } },
        select: {
          id: true,
          internalTripId: true,
          date: true,
          uangJalan: true,
          unit: { select: { unitNumber: true } },
          driver: { select: { name: true } },
        },
      }),
      prisma.invoicePayment.findMany({
        where: { date: range },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: { select: { customerName: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

  const rows: FinancialHppRow[] = [];
  const unitMap = new Map<string, UnitAgg>();
  const unitOf = (n: string) => {
    const u = unitMap.get(n) ?? emptyUnitAgg(n);
    unitMap.set(n, u);
    return u;
  };

  let revenue = 0;
  let totalHpp = 0;
  let totalTonase = 0;
  let solarCost = 0;
  let driverCost = 0;
  let otherHpp = 0;

  // ── Accrual: verified DOs ──
  const hppByDo = computeDoHpp(ops);
  for (const op of ops) {
    const netto = op.netto ?? 0;
    const result = hppByDo.get(op.id)!;
    const otherActual = result.otherActual;
    const rowSolar = result.solarActual;
    const rowHpp = result.totalHpp;
    const rowProfit = result.grossProfit;

    rows.push({
      id: op.id,
      date: formatDateOnly(op.date),
      unitNumber: op.unit.unitNumber,
      driverName: op.driver.name,
      customerName: op.customer?.customerName ?? "—",
      ritase: 1,
      tonase: netto,
      revenue: result.revenue,
      solarCost: rowSolar,
      driverCost: result.driverCost,
      uangJalan: op.uangJalan,
      otherOpsCost: otherActual,
      totalHpp: rowHpp,
      grossProfit: rowProfit,
      profitPerTon: result.profitPerTon,
      marginPercent: result.marginPercent,
    });

    revenue += result.revenue;
    totalHpp += rowHpp;
    totalTonase += netto;
    solarCost += rowSolar;
    driverCost += result.driverCost;
    otherHpp += op.uangJalan + otherActual;

    const u = unitOf(op.unit.unitNumber);
    u.revenue += result.revenue;
    u.totalHpp += rowHpp;
    u.grossProfit += rowProfit;
    u.tonase += netto;
    u.solarCost += rowSolar;
    u.driverCost += result.driverCost;
    u.uangJalan += op.uangJalan;
    u.otherOpsCost += otherActual;
  }

  // ── Operational costs not tied to any DO → period HPP ──
  for (const c of opsCosts) {
    if (c.deliveryOrderId) continue;
    totalHpp += c.amount;
    const u = unitOf(c.unit.unitNumber);
    u.totalHpp += c.amount;
    u.grossProfit -= c.amount;
    if (c.costType === OperationalCostType.SOLAR) {
      solarCost += c.amount;
      u.solarCost += c.amount;
    } else {
      otherHpp += c.amount;
      u.otherOpsCost += c.amount;
    }
  }

  // ── Breakdown maintenance ──
  let breakdownMaintenance = 0;
  for (const b of breakdownRows) {
    breakdownMaintenance += b.maintenanceCost;
    totalHpp += b.maintenanceCost;
    otherHpp += b.maintenanceCost;
    const u = unitOf(b.unit.unitNumber);
    u.totalHpp += b.maintenanceCost;
    u.grossProfit -= b.maintenanceCost;
    u.breakdownCost += b.maintenanceCost;
  }

  // ── Manual journal ──
  let journalOut = 0;
  let journalIn = 0;
  for (const j of journalRows) {
    const u = j.unit?.unitNumber ? unitOf(j.unit.unitNumber) : null;
    if (j.entryType === JournalEntryType.CASH_OUT) {
      journalOut += j.amount;
      if (u) u.journalOut += j.amount;
      // Gaji supir sudah dihitung per DO — pembayarannya hanya mengurangi kas
      if (j.category === JournalCategory.DRIVER) continue;
      totalHpp += j.amount;
      if (j.category === JournalCategory.SOLAR) solarCost += j.amount;
      else otherHpp += j.amount;
      if (u) {
        u.totalHpp += j.amount;
        u.grossProfit -= j.amount;
        if (j.category === JournalCategory.SOLAR) u.solarCost += j.amount;
        else if (j.category === JournalCategory.UANG_JALAN) u.uangJalan += j.amount;
      }
    } else {
      // Pendapatan lain di luar DO (sewa unit, dll.)
      journalIn += j.amount;
      revenue += j.amount;
      if (u) {
        u.revenue += j.amount;
        u.grossProfit += j.amount;
        u.journalIn += j.amount;
      }
    }
  }

  // ── Cash ledger ──
  const ledger: JournalLedgerRow[] = [];
  let paymentsIn = 0;
  let paymentsWithholding = 0;
  for (const p of payments) {
    paymentsIn += p.amount;
    paymentsWithholding += p.withholdingAmount;
    if (p.amount <= 0) continue;
    ledger.push({
      id: `pay-${p.id}`,
      date: formatDateOnly(p.date),
      entryType: JournalEntryType.CASH_IN,
      category: JournalCategory.REVENUE,
      description: `Pembayaran ${p.invoice.invoiceNumber} · ${p.invoice.customer.customerName}`,
      amount: p.amount,
      unitNumber: null,
      notes:
        [p.reference, p.withholdingAmount > 0 ? `PPh 23 dipotong Rp ${Math.round(p.withholdingAmount).toLocaleString("id-ID")}` : null]
          .filter(Boolean)
          .join(" · ") || null,
      createdByName: p.createdBy?.name ?? null,
      source: "PEMBAYARAN",
      href: `/finance/piutang/${p.invoice.id}`,
    });
  }

  let uangJalanOut = 0;
  for (const t of tripsWithUj) {
    uangJalanOut += t.uangJalan;
    ledger.push({
      id: `uj-${t.id}`,
      date: formatDateOnly(t.date),
      entryType: JournalEntryType.CASH_OUT,
      category: JournalCategory.UANG_JALAN,
      description: `Uang jalan ${t.internalTripId} · ${t.driver.name}`,
      amount: t.uangJalan,
      unitNumber: t.unit.unitNumber,
      notes: null,
      createdByName: null,
      source: "UANG_JALAN",
      href: `/operations/trips/${t.id}`,
    });
  }

  let opsCostOut = 0;
  for (const c of opsCosts) {
    opsCostOut += c.amount;
    ledger.push({
      id: `oc-${c.id}`,
      date: formatDateOnly(c.date),
      entryType: JournalEntryType.CASH_OUT,
      category: costCategory(c.costType),
      description: `${c.description}${c.volume ? ` · ${c.volume} L` : ""}`,
      amount: c.amount,
      unitNumber: c.unit.unitNumber,
      notes: c.deliveryOrder ? `Trip ${c.deliveryOrder.internalTripId}` : `Tanpa trip · ${c.driver.name}`,
      createdByName: null,
      source: "BIAYA_OPS",
      href: c.deliveryOrder ? `/operations/trips/${c.deliveryOrder.id}` : undefined,
    });
  }

  for (const b of breakdownRows) {
    ledger.push({
      id: `bd-cost-${b.id}`,
      date: formatDateOnly(b.date),
      entryType: JournalEntryType.CASH_OUT,
      category: JournalCategory.MAINTENANCE,
      description: `Biaya maintenance · ${b.issueDescription}`,
      amount: b.maintenanceCost,
      unitNumber: b.unit.unitNumber,
      notes: "Dari Breakdown History",
      createdByName: null,
      source: "BREAKDOWN",
      href: "/breakdown",
    });
  }

  for (const j of journalRows) {
    ledger.push({
      id: j.id,
      date: formatDateOnly(j.date),
      entryType: j.entryType,
      category: j.category,
      description: j.description,
      amount: j.amount,
      unitNumber: j.unit?.unitNumber ?? null,
      notes: j.notes,
      createdByName: j.createdBy?.name ?? null,
      source: "JOURNAL",
    });
  }

  const sourceOrder: Record<LedgerSource, number> = {
    PEMBAYARAN: 0,
    UANG_JALAN: 1,
    BIAYA_OPS: 2,
    BREAKDOWN: 3,
    JOURNAL: 4,
  };
  ledger.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return sourceOrder[a.source] - sourceOrder[b.source];
  });

  const kasIn = paymentsIn + journalIn;
  const kasOut = uangJalanOut + opsCostOut + breakdownMaintenance + journalOut;

  const opsRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const grossProfit = revenue - totalHpp;

  return {
    periodLabel: `Bulan berjalan — ${monthLabel(from)}`,
    from,
    to,
    summary: {
      revenue,
      totalHpp,
      grossProfit,
      marginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      totalTonase,
      profitPerTon: totalTonase > 0 ? grossProfit / totalTonase : 0,
      solarCost,
      driverCost,
      otherHpp,
      journalOut,
      journalIn,
      opsRevenue,
      breakdownMaintenance,
      paymentsIn,
      paymentsWithholding,
      uangJalanOut,
      opsCostOut,
      kasIn,
      kasOut,
      netKas: kasIn - kasOut,
    },
    rows,
    journals: ledger,
    units,
    byUnit: Array.from(unitMap.values())
      .map((u) => ({
        ...u,
        marginPercent: u.revenue > 0 ? (u.grossProfit / u.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.grossProfit - a.grossProfit),
  };
}

export type UnitProfitDetail = {
  periodLabel: string;
  from: string;
  to: string;
  unit: UnitProfitSummary;
  /** DO trips for this unit in period */
  trips: FinancialHppRow[];
  /** Kas lines assigned to this unit (uang jalan, biaya ops, breakdown, jurnal) */
  movements: JournalLedgerRow[];
  costLines: { label: string; amount: number; note?: string }[];
};

export async function getUnitProfitDetail(
  unitNumber: string,
  referenceDate?: string
): Promise<UnitProfitDetail | null> {
  const data = await getFinancialHppData(referenceDate);
  const unit = data.byUnit.find(
    (u) => u.unitNumber.toLowerCase() === unitNumber.toLowerCase()
  );
  if (!unit) return null;

  return {
    periodLabel: data.periodLabel,
    from: data.from,
    to: data.to,
    unit,
    trips: data.rows.filter(
      (r) => r.unitNumber.toLowerCase() === unitNumber.toLowerCase()
    ),
    movements: data.journals.filter(
      (j) =>
        j.unitNumber &&
        j.unitNumber.toLowerCase() === unitNumber.toLowerCase()
    ),
    costLines: buildUnitCostLines(unit),
  };
}

function buildUnitCostLines(
  unit: UnitProfitSummary
): UnitProfitDetail["costLines"] {
  const lines: UnitProfitDetail["costLines"] = [];
  const push = (label: string, amount: number, note?: string) => {
    if (amount > 0) lines.push({ label, amount, note });
  };

  push("Uang jalan", unit.uangJalan, "Aktual per trip + jurnal kategori Uang Jalan");
  push("Solar", unit.solarCost, "Nota solar terverifikasi + jurnal kategori Solar");
  push("Supir", unit.driverCost, "Gaji dari DO (Master Driver) + jurnal kategori Driver");
  push("Biaya lain aktual", unit.otherOpsCost, "Biaya Lain terverifikasi dari foto Supir");
  push("Breakdown / perbaikan", unit.breakdownCost, "Biaya aktual dari Breakdown History");

  const accounted =
    unit.uangJalan +
    unit.solarCost +
    unit.driverCost +
    unit.otherOpsCost +
    unit.breakdownCost;
  const residual = Math.max(0, unit.totalHpp - accounted);
  if (residual > 1) {
    lines.push({
      label: "Jurnal kas keluar lain",
      amount: residual,
      note: "Kas keluar manual unit ini (maintenance, ban, cicilan, dll.)",
    });
  }

  return lines.sort((a, b) => b.amount - a.amount);
}
