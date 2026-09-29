import { UnitsClient } from "@/components/masters/units-client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { syncUnitBreakdownStatus } from "@/lib/breakdown/unit-status";

export const dynamic = "force-dynamic";

export default async function MastersUnitsPage() {
  const session = await getCurrentSession();
  const canWrite =
    !!session &&
    (hasPermission(session.user.role, "masters:write") ||
      hasPermission(session.user.role, "*"));

  await syncUnitBreakdownStatus();

  const [units, drivers] = await Promise.all([
    prisma.masterUnit.findMany({
      include: { defaultDriver: { select: { name: true } } },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.masterDriver.findMany({
      select: {
        id: true,
        name: true,
        driverId: true,
        assignedUnit: { select: { unitNumber: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <UnitsClient
      canWrite={canWrite}
      drivers={drivers.map((d) => ({
        id: d.id,
        name: d.name,
        driverId: d.driverId,
        unitNumber: d.assignedUnit?.unitNumber ?? null,
      }))}
      units={units.map((u) => ({
        id: u.id,
        unitNumber: u.unitNumber,
        brandType: u.brandType,
        year: u.year,
        licensePlate: u.licensePlate,
        capacity: u.capacity,
        status: u.status,
        currentKm: u.currentKm,
        operationStartDate: u.operationStartDate
          ? u.operationStartDate.toISOString().slice(0, 10)
          : null,
        defaultDriverId: u.defaultDriverId,
        defaultDriverName: u.defaultDriver?.name ?? null,
      }))}
    />
  );
}
