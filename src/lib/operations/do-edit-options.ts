import { OperationalCostType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  TripEditData,
  TripEditOptions,
} from "@/components/operations/trip-edit-dialog";

export async function getDoEditOptions(): Promise<TripEditOptions> {
  const [units, drivers, trips] = await Promise.all([
    prisma.masterUnit.findMany({
      select: { id: true, unitNumber: true, defaultDriverId: true },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.masterDriver.findMany({
      select: {
        id: true,
        name: true,
        salarySystem: true,
        driverRatePerTon: true,
        monthlySalary: true,
        dailySalary: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.customerTrip.findMany({
      include: { customer: { select: { customerName: true, ratePerTon: true } } },
      orderBy: [{ customer: { customerName: "asc" } }, { name: "asc" }],
    }),
  ]);
  return {
    units,
    drivers,
    trips: trips.map((t) => ({
      id: t.id,
      customerId: t.customerId,
      name: t.name,
      customerName: t.customer.customerName,
      ratePerTon: t.ratePerTon ?? t.customer.ratePerTon,
      uangJalan: t.uangJalan ?? 0,
    })),
  };
}

/** Solar & biaya lain DO (dari verifikasi) → field form Edit DO */
export function doCostEditFields(
  costs: {
    costType: OperationalCostType;
    amount: number;
    volume: number | null;
    pricePerLiter: number | null;
    description: string;
  }[]
): Pick<
  TripEditData,
  "solarLiters" | "solarPricePerLiter" | "otherAmount" | "otherDescription"
> {
  const solar = costs.find((c) => c.costType === OperationalCostType.SOLAR);
  const other = costs.find((c) => c.costType !== OperationalCostType.SOLAR);
  return {
    solarLiters: solar?.volume ?? null,
    solarPricePerLiter:
      solar?.pricePerLiter ??
      (solar?.volume ? Math.round(solar.amount / solar.volume) : null),
    otherAmount: other?.amount ?? null,
    otherDescription: other?.description ?? null,
  };
}
