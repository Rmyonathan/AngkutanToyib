import { Prisma, UnitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Breakdown is ongoing: already started and not yet finished (end empty or in the future). */
export function activeBreakdownWhere(now: Date = new Date()) {
  return {
    startTime: { lte: now },
    OR: [{ endTime: null }, { endTime: { gt: now } }],
  } satisfies Prisma.BreakdownHistoryWhereInput;
}

/**
 * Align MasterUnit.status with breakdown history:
 * - active breakdown → BREAKDOWN
 * - status BREAKDOWN with no active breakdown → RUNNING
 * STANDBY / MAINTENANCE set manually are only overridden by an active breakdown.
 *
 * Status depends on the clock (a breakdown with a future end time ends by
 * itself), so this also runs on read in dashboard / units / breakdown pages.
 */
export async function syncUnitBreakdownStatus(
  db: Db = prisma,
  unitIds?: string[]
) {
  const now = new Date();
  const scope = unitIds?.length ? { id: { in: unitIds } } : {};

  const active = await db.breakdownHistory.findMany({
    where: {
      ...activeBreakdownWhere(now),
      ...(unitIds?.length ? { unitId: { in: unitIds } } : {}),
    },
    select: { unitId: true },
    distinct: ["unitId"],
  });
  const activeIds = active.map((a) => a.unitId);

  await db.masterUnit.updateMany({
    where: {
      ...scope,
      id: { in: activeIds },
      status: { not: UnitStatus.BREAKDOWN },
    },
    data: { status: UnitStatus.BREAKDOWN },
  });

  await db.masterUnit.updateMany({
    where: {
      ...(unitIds?.length ? { id: { in: unitIds, notIn: activeIds } } : { id: { notIn: activeIds } }),
      status: UnitStatus.BREAKDOWN,
    },
    data: { status: UnitStatus.RUNNING },
  });
}
