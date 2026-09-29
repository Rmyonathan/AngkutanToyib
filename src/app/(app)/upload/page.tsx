import { redirect } from "next/navigation";
import { UploadClient } from "@/components/operations/upload-client";
import { getCurrentSession } from "@/lib/auth/session";
import { canSubmitFieldDocs, canVerifyFieldDocs } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { isUploadThingConfigured } from "@/lib/upload/config";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await getCurrentSession();
  if (!session || !canSubmitFieldDocs(session.user.role)) {
    redirect("/login?error=forbidden");
  }

  const ownDriver = await prisma.masterDriver.findUnique({
    where: { userId: session.user.id },
    include: { assignedUnit: { select: { id: true, unitNumber: true } } },
  });
  const onBehalf = !ownDriver && canVerifyFieldDocs(session.user.role);

  const [trips, drivers, units, recent] = await Promise.all([
    prisma.customerTrip.findMany({
      where: { isActive: true, customer: { isActive: true } },
      include: { customer: { select: { customerName: true } } },
      orderBy: [{ customer: { customerName: "asc" } }, { name: "asc" }],
    }),
    onBehalf
      ? prisma.masterDriver.findMany({
          include: { assignedUnit: { select: { id: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    onBehalf
      ? prisma.masterUnit.findMany({
          select: { id: true, unitNumber: true },
          orderBy: { unitNumber: "asc" },
        })
      : Promise.resolve([]),
    prisma.fieldSubmission.findMany({
      where: ownDriver
        ? { driverId: ownDriver.id }
        : { createdById: session.user.id },
      include: {
        customerTrip: {
          select: { name: true, customer: { select: { customerName: true } } },
        },
        deliveryOrder: { select: { internalTripId: true, netto: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <UploadClient
      useCloudUpload={isUploadThingConfigured()}
      identity={
        ownDriver
          ? {
              driverName: ownDriver.name,
              unitNumber: ownDriver.assignedUnit?.unitNumber ?? null,
            }
          : null
      }
      onBehalf={onBehalf}
      trips={trips.map((t) => ({
        id: t.id,
        name: t.name,
        customerName: t.customer.customerName,
      }))}
      drivers={drivers.map((d) => ({
        id: d.id,
        name: d.name,
        unitId: d.assignedUnit?.id ?? null,
      }))}
      units={units}
      recent={recent.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        tripName: r.customerTrip.name,
        customerName: r.customerTrip.customer.customerName,
        status: r.status,
        rejectReason: r.rejectReason,
        hasSolar: !!r.solarPhoto,
        doNumber: r.deliveryOrder?.internalTripId ?? null,
        netto: r.deliveryOrder?.netto ?? null,
      }))}
    />
  );
}
