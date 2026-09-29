import { redirect } from "next/navigation";
import { OperationsReportView } from "@/components/reports/operations-report-view";
import { requireSession } from "@/lib/auth/session";
import { canAccessReports } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getOperationsReport } from "@/lib/reports/get-operations-report";
import { monthStart, todayDateOnly, tryParseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

function parseDate(value: string | undefined, fallback: string): string {
  return value && tryParseDateOnly(value) ? value.slice(0, 10) : fallback;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    unitId?: string;
    customerId?: string;
  };
}) {
  const session = await requireSession();
  if (!canAccessReports(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const today = todayDateOnly();
  const from = parseDate(searchParams.from, monthStart(today));
  let to = parseDate(searchParams.to, today);
  if (to < from) to = from;

  const [report, units, customers] = await Promise.all([
    getOperationsReport({
      from,
      to,
      unitId: searchParams.unitId || null,
      customerId: searchParams.customerId || null,
    }),
    prisma.masterUnit.findMany({
      select: { id: true, unitNumber: true },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.masterCustomer.findMany({
      select: { id: true, customerName: true },
      orderBy: { customerName: "asc" },
    }),
  ]);

  return (
    <OperationsReportView
      report={report}
      units={units.map((u) => ({ id: u.id, label: u.unitNumber }))}
      customers={customers.map((c) => ({ id: c.id, label: c.customerName }))}
    />
  );
}
