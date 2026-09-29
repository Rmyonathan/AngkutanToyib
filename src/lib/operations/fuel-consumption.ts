import { OperationalCostType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DO_REVENUE_STATUSES } from "@/lib/operations/do-status";
import { dateOnlyRange, formatDateOnly } from "@/lib/dates";

/**
 * Konsumsi solar per unit:
 *   liter & rupiah  ← nota Solar yang sudah diverifikasi (OperationalCost SOLAR)
 *   KM              ← KM hauling yang diisi saat verifikasi timbangan (DO)
 *   ritase & tonase ← DO terverifikasi
 * Pengisian solar tidak selalu sama hari dengan pemakaian, jadi angka
 * per periode (minggu / bulan) lebih akurat daripada per hari.
 */

export type FuelMetrics = {
  liters: number;
  solarCost: number;
  /** Rp/L from notes that have liters filled */
  pricePerLiter: number;
  km: number;
  ritase: number;
  tonase: number;
  litersPerKm: number;
  kmPerLiter: number;
  litersPerRit: number;
  litersPerTon: number;
  fuelCostPerTon: number;
  fuelCostPerKm: number;
};

export type FuelStatus = "BOROS" | "NORMAL" | "HEMAT" | "DATA_KURANG";

export type FuelUnitRow = FuelMetrics & {
  unitId: string;
  unitNumber: string;
  brandType: string;
  notesCount: number;
  notesWithoutLiters: number;
  tripsWithoutKm: number;
  /** % above (+) / below (−) fleet L/km */
  deviationPercent: number | null;
  status: FuelStatus;
};

export type FuelDailyRow = FuelMetrics & {
  date: string;
  unitNumber: string;
};

export type FuelConsumptionData = {
  from: string;
  to: string;
  unitId: string | null;
  thresholdPercent: number;
  fleet: FuelMetrics;
  units: FuelUnitRow[];
  daily: FuelDailyRow[];
  unitOptions: { id: string; label: string }[];
};

type Acc = {
  liters: number;
  solarCost: number;
  costWithLiters: number;
  km: number;
  ritase: number;
  tonase: number;
};

const emptyAcc = (): Acc => ({
  liters: 0,
  solarCost: 0,
  costWithLiters: 0,
  km: 0,
  ritase: 0,
  tonase: 0,
});

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

function metrics(a: Acc): FuelMetrics {
  return {
    liters: a.liters,
    solarCost: a.solarCost,
    pricePerLiter: div(a.costWithLiters, a.liters),
    km: a.km,
    ritase: a.ritase,
    tonase: a.tonase,
    litersPerKm: div(a.liters, a.km),
    kmPerLiter: div(a.km, a.liters),
    litersPerRit: div(a.liters, a.ritase),
    litersPerTon: div(a.liters, a.tonase),
    fuelCostPerTon: div(a.solarCost, a.tonase),
    fuelCostPerKm: div(a.solarCost, a.km),
  };
}

export async function getFuelConsumption(opts: {
  from: string;
  to: string;
  unitId?: string | null;
  thresholdPercent?: number;
}): Promise<FuelConsumptionData> {
  const range = dateOnlyRange(opts.from, opts.to);
  const threshold = opts.thresholdPercent ?? 15;

  const [costs, dos, units] = await Promise.all([
    prisma.operationalCost.findMany({
      where: { costType: OperationalCostType.SOLAR, date: range },
      select: { unitId: true, date: true, amount: true, volume: true },
    }),
    prisma.deliveryOrder.findMany({
      where: { date: range, status: { in: DO_REVENUE_STATUSES } },
      select: { unitId: true, date: true, netto: true, kmHauling: true },
    }),
    prisma.masterUnit.findMany({
      select: { id: true, unitNumber: true, brandType: true },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  const perUnit = new Map<
    string,
    Acc & { notesCount: number; notesWithoutLiters: number; tripsWithoutKm: number }
  >();
  const perDay = new Map<string, Acc>();
  const unitAcc = (id: string) => {
    let a = perUnit.get(id);
    if (!a) {
      a = { ...emptyAcc(), notesCount: 0, notesWithoutLiters: 0, tripsWithoutKm: 0 };
      perUnit.set(id, a);
    }
    return a;
  };
  const dayAcc = (id: string, date: Date) => {
    const key = `${id}|${formatDateOnly(date)}`;
    let a = perDay.get(key);
    if (!a) {
      a = emptyAcc();
      perDay.set(key, a);
    }
    return a;
  };

  for (const c of costs) {
    const liters = c.volume ?? 0;
    for (const a of [unitAcc(c.unitId), dayAcc(c.unitId, c.date)]) {
      a.solarCost += c.amount;
      a.liters += liters;
      if (liters > 0) a.costWithLiters += c.amount;
    }
    const u = unitAcc(c.unitId);
    u.notesCount += 1;
    if (liters <= 0) u.notesWithoutLiters += 1;
  }

  for (const d of dos) {
    const km = d.kmHauling ?? 0;
    for (const a of [unitAcc(d.unitId), dayAcc(d.unitId, d.date)]) {
      a.ritase += 1;
      a.tonase += d.netto ?? 0;
      a.km += km;
    }
    if (!d.kmHauling) unitAcc(d.unitId).tripsWithoutKm += 1;
  }

  // Fleet L/km only from units that have both liters and km
  const fleetAcc = emptyAcc();
  const benchmark = { liters: 0, km: 0 };
  for (const a of Array.from(perUnit.values())) {
    fleetAcc.liters += a.liters;
    fleetAcc.solarCost += a.solarCost;
    fleetAcc.costWithLiters += a.costWithLiters;
    fleetAcc.km += a.km;
    fleetAcc.ritase += a.ritase;
    fleetAcc.tonase += a.tonase;
    if (a.liters > 0 && a.km > 0) {
      benchmark.liters += a.liters;
      benchmark.km += a.km;
    }
  }
  const fleetLpk = div(benchmark.liters, benchmark.km);

  const unitById = new Map(units.map((u) => [u.id, u]));
  const rows: FuelUnitRow[] = [];
  for (const [unitId, a] of Array.from(perUnit.entries())) {
    const u = unitById.get(unitId);
    if (!u) continue;
    const m = metrics(a);
    let deviationPercent: number | null = null;
    let status: FuelStatus = "DATA_KURANG";
    if (a.liters > 0 && a.km > 0 && fleetLpk > 0) {
      deviationPercent = (m.litersPerKm / fleetLpk - 1) * 100;
      status =
        deviationPercent > threshold
          ? "BOROS"
          : deviationPercent < -threshold
            ? "HEMAT"
            : "NORMAL";
    }
    rows.push({
      ...m,
      unitId,
      unitNumber: u.unitNumber,
      brandType: u.brandType,
      notesCount: a.notesCount,
      notesWithoutLiters: a.notesWithoutLiters,
      tripsWithoutKm: a.tripsWithoutKm,
      deviationPercent,
      status,
    });
  }
  const statusOrder: Record<FuelStatus, number> = { BOROS: 0, NORMAL: 1, HEMAT: 2, DATA_KURANG: 3 };
  rows.sort(
    (x, y) =>
      statusOrder[x.status] - statusOrder[y.status] ||
      (y.deviationPercent ?? 0) - (x.deviationPercent ?? 0)
  );

  const daily: FuelDailyRow[] = [];
  for (const [key, a] of Array.from(perDay.entries())) {
    const [unitId, date] = key.split("|");
    if (opts.unitId && unitId !== opts.unitId) continue;
    daily.push({ ...metrics(a), date, unitNumber: unitById.get(unitId)?.unitNumber ?? "?" });
  }
  daily.sort((a, b) => b.date.localeCompare(a.date) || a.unitNumber.localeCompare(b.unitNumber));

  const fleet = metrics(fleetAcc);
  fleet.litersPerKm = fleetLpk;
  fleet.kmPerLiter = div(benchmark.km, benchmark.liters);

  return {
    from: opts.from,
    to: opts.to,
    unitId: opts.unitId ?? null,
    thresholdPercent: threshold,
    fleet,
    units: opts.unitId ? rows.filter((r) => r.unitId === opts.unitId) : rows,
    daily,
    unitOptions: units.map((u) => ({ id: u.id, label: u.unitNumber })),
  };
}
