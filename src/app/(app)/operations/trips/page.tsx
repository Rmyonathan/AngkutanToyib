import { redirect } from "next/navigation";
import { FieldSubmissionStatus } from "@prisma/client";
import { TripsClient } from "@/components/operations/trips-client";
import { requireSession } from "@/lib/auth/session";
import { canManageTrips, canVerifyFieldDocs, hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { doCostEditFields, getDoEditOptions } from "@/lib/operations/do-edit-options";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const session = await requireSession();
  const canRead =
    hasPermission(session.user.role, "operations:read") ||
    canManageTrips(session.user.role) ||
    hasPermission(session.user.role, "ops:verify");
  if (!canRead) redirect("/dashboard?error=forbidden");

  const canWrite = canManageTrips(session.user.role);

  const [trips, pendingUploads, options] = await Promise.all([
    prisma.deliveryOrder.findMany({
      include: {
        unit: { select: { unitNumber: true } },
        driver: {
          select: {
            name: true,
            salarySystem: true,
            driverRatePerTon: true,
            monthlySalary: true,
            dailySalary: true,
          },
        },
        customer: { select: { customerName: true } },
        customerTrip: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
        operationalCosts: {
          select: { costType: true, amount: true, volume: true, pricePerLiter: true, description: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.fieldSubmission.count({
      where: { status: FieldSubmissionStatus.PENDING },
    }),
    canWrite ? getDoEditOptions() : Promise.resolve(null),
  ]);

  return (
    <TripsClient
      canWrite={canWrite}
      canVerify={canVerifyFieldDocs(session.user.role)}
      pendingUploads={pendingUploads}
      options={options}
      trips={trips.map((t) => ({
        id: t.id,
        internalTripId: t.internalTripId,
        date: t.date.toISOString().slice(0, 10),
        unitId: t.unitId,
        unitNumber: t.unit.unitNumber,
        driverId: t.driverId,
        driverName: t.driver.name,
        customerTripId: t.customerTripId,
        customerId: t.customerId,
        invoiceNumber: t.invoice?.invoiceNumber ?? null,
        ...doCostEditFields(t.operationalCosts),
        tripName: t.customerTrip?.name ?? null,
        customerName: t.customer?.customerName ?? null,
        uangJalan: t.uangJalan,
        ratePerTon: t.ratePerTon,
        driverPayMode: t.driverPayMode,
        driverPayAmount: t.driverPayAmount,
        notes: t.notes,
        ticketNumber: t.ticketNumber,
        netto: t.netto,
        kmHauling: t.kmHauling,
        status: t.status,
      }))}
    />
  );
}
