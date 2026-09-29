import { redirect } from "next/navigation";
import { FieldSubmissionStatus, OperationalCostType } from "@prisma/client";
import { VerifyInboxClient } from "@/components/operations/verify-client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { canVerifyFieldDocs } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const session = await getCurrentSession();
  if (!session || !canVerifyFieldDocs(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const [pending, trips, lastSolar] = await Promise.all([
    prisma.fieldSubmission.findMany({
      where: { status: FieldSubmissionStatus.PENDING },
      include: {
        driver: { select: { name: true } },
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerTrip.findMany({
      include: { customer: { select: { customerName: true, ratePerTon: true } } },
      orderBy: [{ customer: { customerName: "asc" } }, { name: "asc" }],
    }),
    prisma.operationalCost.findFirst({
      where: { costType: OperationalCostType.SOLAR, pricePerLiter: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      select: { pricePerLiter: true },
    }),
  ]);

  return (
    <VerifyInboxClient
      defaultSolarPrice={lastSolar?.pricePerLiter ?? 0}
      trips={trips.map((t) => ({
        id: t.id,
        name: t.name,
        customerName: t.customer.customerName,
        ratePerTon: t.ratePerTon ?? t.customer.ratePerTon,
        uangJalan: t.uangJalan ?? 0,
        distanceKm: t.distanceKm,
        isActive: t.isActive,
      }))}
      pending={pending.map((p) => ({
        id: p.id,
        date: p.date.toISOString().slice(0, 10),
        unitNumber: p.unit.unitNumber,
        driverName: p.driver.name,
        customerTripId: p.customerTripId,
        suratJalanPhoto: p.suratJalanPhoto,
        solarPhoto: p.solarPhoto,
        otherPhoto: p.otherPhoto,
        notes: p.notes,
      }))}
    />
  );
}
