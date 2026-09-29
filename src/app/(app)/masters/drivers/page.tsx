import { DriversClient } from "@/components/masters/drivers-client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function MastersDriversPage() {
  const session = await getCurrentSession();
  const canWrite =
    !!session &&
    (hasPermission(session.user.role, "masters:write") ||
      hasPermission(session.user.role, "*"));

  const [drivers, units] = await Promise.all([
    prisma.masterDriver.findMany({
      include: {
        assignedUnit: { select: { id: true, unitNumber: true } },
        user: { select: { email: true, isActive: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.masterUnit.findMany({
      select: {
        id: true,
        unitNumber: true,
        defaultDriver: { select: { id: true, name: true } },
      },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  return (
    <DriversClient
      canWrite={canWrite}
      units={units.map((u) => ({
        id: u.id,
        unitNumber: u.unitNumber,
        driverId: u.defaultDriver?.id ?? null,
        driverName: u.defaultDriver?.name ?? null,
      }))}
      drivers={drivers.map((d) => ({
        id: d.id,
        name: d.name,
        driverId: d.driverId,
        unitId: d.assignedUnit?.id ?? null,
        unitNumber: d.assignedUnit?.unitNumber ?? null,
        username: d.user?.email ?? null,
        loginActive: d.user?.isActive ?? false,
        salarySystem: d.salarySystem,
        driverRatePerTon: d.driverRatePerTon,
        monthlySalary: d.monthlySalary,
        dailySalary: d.dailySalary,
        attendanceStatus: d.attendanceStatus,
      }))}
    />
  );
}
