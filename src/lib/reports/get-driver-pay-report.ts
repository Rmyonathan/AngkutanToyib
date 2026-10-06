import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DO_REVENUE_STATUSES } from "@/lib/operations/do-status";
import { dateOnlyRange, formatDateOnly } from "@/lib/dates";
import {
  computeDoHpp,
  DO_HPP_INCLUDE,
  type DoWithHppRelations,
} from "@/lib/finance/do-hpp";
import { DRIVER_PAY_MODE_LABEL } from "@/lib/operations/driver-pay-mode";
import type { DoDriverPayMode } from "@/lib/operations/driver-pay-mode";

export type DriverPayTripRow = {
  id: string;
  internalTripId: string;
  date: string;
  unitNumber: string;
  customerName: string | null;
  tripName: string | null;
  ticketNumber: string | null;
  netto: number;
  payMode: DoDriverPayMode;
  payModeLabel: string;
  payNominal: number;
  gaji: number;
};

export type DriverPayDriverRow = {
  driverId: string;
  driverName: string;
  ritase: number;
  tonase: number;
  totalGaji: number;
  trips: DriverPayTripRow[];
};

export type DriverPayReport = {
  period: { from: string; to: string };
  summary: {
    ritase: number;
    tonase: number;
    totalGaji: number;
    driverCount: number;
  };
  drivers: DriverPayDriverRow[];
};

const iso = formatDateOnly;

export async function getDriverPayReport(filters: {
  from: string;
  to: string;
  driverId?: string | null;
}): Promise<DriverPayReport> {
  const range = dateOnlyRange(filters.from, filters.to);
  const driverId = filters.driverId || null;

  const where: Prisma.DeliveryOrderWhereInput = {
    date: range,
    status: { in: DO_REVENUE_STATUSES },
    ...(driverId ? { driverId } : {}),
  };

  const dos = await prisma.deliveryOrder.findMany({
    where,
    include: {
      ...DO_HPP_INCLUDE,
      customer: { select: { customerName: true } },
      customerTrip: { select: { name: true } },
    },
    orderBy: [{ driver: { name: "asc" } }, { date: "asc" }, { internalTripId: "asc" }],
  });

  const hppMap = computeDoHpp(dos as DoWithHppRelations[]);

  const byDriver = new Map<string, DriverPayDriverRow>();

  for (const d of dos) {
    const hpp = hppMap.get(d.id);
    const gaji = hpp?.driverCost ?? 0;
    const netto = d.netto ?? 0;
    const payMode = d.driverPayMode as DoDriverPayMode;

    let row = byDriver.get(d.driverId);
    if (!row) {
      row = {
        driverId: d.driverId,
        driverName: d.driver.name,
        ritase: 0,
        tonase: 0,
        totalGaji: 0,
        trips: [],
      };
      byDriver.set(d.driverId, row);
    }
    row.ritase += 1;
    row.tonase += netto;
    row.totalGaji += gaji;
    row.trips.push({
      id: d.id,
      internalTripId: d.internalTripId,
      date: iso(d.date),
      unitNumber: d.unit.unitNumber,
      customerName: d.customer?.customerName ?? null,
      tripName: d.customerTrip?.name ?? null,
      ticketNumber: d.ticketNumber,
      netto,
      payMode,
      payModeLabel: DRIVER_PAY_MODE_LABEL[payMode],
      payNominal: d.driverPayAmount ?? 0,
      gaji,
    });
  }

  const drivers = Array.from(byDriver.values()).sort((a, b) =>
    a.driverName.localeCompare(b.driverName)
  );

  const summary = {
    ritase: dos.length,
    tonase: drivers.reduce((s, d) => s + d.tonase, 0),
    totalGaji: drivers.reduce((s, d) => s + d.totalGaji, 0),
    driverCount: drivers.length,
  };

  return {
    period: { from: filters.from, to: filters.to },
    summary,
    drivers,
  };
}
