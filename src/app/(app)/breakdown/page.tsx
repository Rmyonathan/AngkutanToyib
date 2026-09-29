import { Suspense } from "react";
import { BreakdownClient } from "@/components/breakdown/breakdown-client";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { computeMonthlyBreakdownStats } from "@/lib/breakdown/stats";
import { syncUnitBreakdownStatus } from "@/lib/breakdown/unit-status";
import { dateOnlyRange, monthEnd, monthStart, todayDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseMonth(month: string | undefined): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  return monthStart(todayDateOnly());
}

export default async function BreakdownPage({
  searchParams,
}: {
  searchParams: { unitId?: string; month?: string };
}) {
  const session = await requireSession();
  const canWrite =
    hasPermission(session.user.role, "breakdown:write") ||
    hasPermission(session.user.role, "*");

  const filterUnitId = searchParams.unitId ?? "";
  const refDate = parseMonth(searchParams.month);
  const filterMonth = refDate.slice(0, 7);

  await syncUnitBreakdownStatus();

  const [units, records] = await Promise.all([
    prisma.masterUnit.findMany({
      select: { id: true, unitNumber: true },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.breakdownHistory.findMany({
      where: {
        date: dateOnlyRange(refDate, monthEnd(refDate)),
        ...(filterUnitId ? { unitId: filterUnitId } : {}),
      },
      include: { unit: { select: { unitNumber: true } } },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
  ]);

  const unitCount = filterUnitId ? 1 : Math.max(units.length, 1);
  const stats = computeMonthlyBreakdownStats(
    records.map((r) => ({
      downtimeHours: r.downtimeHours,
      maintenanceCost: r.maintenanceCost,
      unitId: r.unitId,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    unitCount,
    refDate
  );

  const rows = records.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    unitNumber: r.unit.unitNumber,
    date: r.date.toISOString().slice(0, 10),
    issueDescription: r.issueDescription,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime?.toISOString() ?? null,
    downtimeHours: r.downtimeHours,
    maintenanceCost: r.maintenanceCost,
  }));

  return (
    <Suspense fallback={<p className="text-sm text-neutral-400">Memuat…</p>}>
      <BreakdownClient
        rows={rows}
        units={units}
        stats={stats}
        canWrite={canWrite}
        filterUnitId={filterUnitId}
        filterMonth={filterMonth}
      />
    </Suspense>
  );
}
