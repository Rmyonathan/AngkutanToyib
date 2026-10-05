import { redirect } from "next/navigation";
import { DriverPayReportView } from "@/components/reports/driver-pay-report-view";
import { requireSession } from "@/lib/auth/session";
import { canAccessReports } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getDriverPayReport } from "@/lib/reports/get-driver-pay-report";
import { monthStart, todayDateOnly, tryParseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

function parseDate(value: string | undefined, fallback: string): string {
  return value && tryParseDateOnly(value) ? value.slice(0, 10) : fallback;
}

export default async function DriverPayReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; driverId?: string };
}) {
  const session = await requireSession();
  if (!canAccessReports(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const today = todayDateOnly();
  const from = parseDate(searchParams.from, monthStart(today));
  let to = parseDate(searchParams.to, today);
  if (to < from) to = from;

  const [report, drivers] = await Promise.all([
    getDriverPayReport({
      from,
      to,
      driverId: searchParams.driverId || null,
    }),
    prisma.masterDriver.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <DriverPayReportView
      report={report}
      drivers={drivers.map((d) => ({ id: d.id, label: d.name }))}
      initialDriverId={searchParams.driverId ?? ""}
    />
  );
}
