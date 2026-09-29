import { notFound, redirect } from "next/navigation";
import { TripDetailView } from "@/components/operations/trip-detail-view";
import { TripEditButton } from "@/components/operations/trip-edit-dialog";
import { requireSession } from "@/lib/auth/session";
import { canManageTrips, hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { DO_STATUS_LABEL } from "@/lib/operations/do-status";
import { doCostEditFields, getDoEditOptions } from "@/lib/operations/do-edit-options";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const canRead =
    hasPermission(session.user.role, "operations:read") ||
    canManageTrips(session.user.role) ||
    hasPermission(session.user.role, "ops:verify");
  if (!canRead) redirect("/dashboard?error=forbidden");
  const canWrite = canManageTrips(session.user.role);

  const trip = await prisma.deliveryOrder.findUnique({
    where: { id: params.id },
    include: {
      unit: { select: { unitNumber: true } },
      driver: { select: { name: true } },
      customer: { select: { customerName: true } },
      customerTrip: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
      fieldSubmission: {
        include: { createdBy: { select: { name: true } } },
      },
      operationalCosts: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!trip) notFound();

  const editOptions = canWrite ? await getDoEditOptions() : null;
  const dateStr = trip.date.toISOString().slice(0, 10);
  const sub = trip.fieldSubmission;

  return (
    <TripDetailView
      actions={
        editOptions ? (
          <TripEditButton
            options={editOptions}
            trip={{
              id: trip.id,
              internalTripId: trip.internalTripId,
              date: dateStr,
              unitId: trip.unitId,
              driverId: trip.driverId,
              customerTripId: trip.customerTripId,
              customerId: trip.customerId,
              invoiceNumber: trip.invoice?.invoiceNumber ?? null,
              ...doCostEditFields(trip.operationalCosts),
              uangJalan: trip.uangJalan,
              ratePerTon: trip.ratePerTon,
              notes: trip.notes,
              status: trip.status,
              ticketNumber: trip.ticketNumber,
              netto: trip.netto,
              kmHauling: trip.kmHauling,
            }}
          />
        ) : null
      }
      trip={{
        id: trip.id,
        internalTripId: trip.internalTripId,
        date: dateStr,
        status: trip.status,
        statusLabel: DO_STATUS_LABEL[trip.status],
        unitNumber: trip.unit.unitNumber,
        driverName: trip.driver.name,
        customerName: trip.customer?.customerName ?? null,
        tripName: trip.customerTrip?.name ?? null,
        ticketNumber: trip.ticketNumber,
        netto: trip.netto,
        ratePerTon: trip.ratePerTon,
        uangJalan: trip.uangJalan,
        kmHauling: trip.kmHauling,
        notes: trip.notes,
        upload: sub
          ? {
              date: sub.date.toISOString().slice(0, 10),
              uploadedBy: sub.createdBy.name,
              suratJalanPhoto: sub.suratJalanPhoto,
              solarPhoto: sub.solarPhoto,
              otherPhoto: sub.otherPhoto,
              notes: sub.notes,
            }
          : null,
        suratJalanPhoto: trip.suratJalanPhoto,
        costs: trip.operationalCosts.map((c) => ({
          id: c.id,
          costType: c.costType,
          amount: c.amount,
          volume: c.volume,
          pricePerLiter: c.pricePerLiter,
          description: c.description,
        })),
      }}
    />
  );
}
