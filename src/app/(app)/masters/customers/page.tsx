import { CustomersClient } from "@/components/masters/customers-client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function MastersCustomersPage() {
  const session = await getCurrentSession();
  const canWrite =
    !!session &&
    (hasPermission(session.user.role, "masters:write") ||
      hasPermission(session.user.role, "*"));

  const customers = await prisma.masterCustomer.findMany({
    include: { trips: { orderBy: { name: "asc" } } },
    orderBy: { customerName: "asc" },
  });

  return (
    <CustomersClient
      canWrite={canWrite}
      customers={customers.map((c) => ({
        id: c.id,
        customerName: c.customerName,
        loadingLocation: c.loadingLocation,
        dumpingLocation: c.dumpingLocation,
        oneWayDistance: c.oneWayDistance,
        ratePerTon: c.ratePerTon,
        targetTonase: c.targetTonase,
        paymentTermDays: c.paymentTermDays,
        isActive: c.isActive,
        trips: c.trips.map((t) => ({
          id: t.id,
          name: t.name,
          distanceKm: t.distanceKm,
          ratePerTon: t.ratePerTon,
          uangJalan: t.uangJalan,
          isActive: t.isActive,
        })),
      }))}
    />
  );
}
