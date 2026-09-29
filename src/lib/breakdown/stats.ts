import { monthEnd, monthLabel, monthStart, parseDateOnly } from "@/lib/dates";
import { isBreakdownActive } from "@/lib/breakdown/active";

export type BreakdownStatRow = {
  downtimeHours: number | null;
  maintenanceCost: number;
  unitId: string;
  startTime: Date;
  endTime: Date | null;
};

export type BreakdownMonthlyStats = {
  periodLabel: string;
  totalDowntimeHours: number;
  totalMaintenanceCost: number;
  /** Ongoing right now (started, end empty or in the future) */
  openCount: number;
  closedCount: number;
  unitCount: number;
  /** (availableHours − downtime) / availableHours × 100 */
  availabilityPercent: number;
  availableHours: number;
};

/**
 * Monthly fleet availability:
 * availableHours = daysInMonth × 24 × unitCount
 * availability = (available − downtime) / available × 100
 */
export function computeMonthlyBreakdownStats(
  rows: BreakdownStatRow[],
  unitCount: number,
  /** Any "YYYY-MM-DD" inside the month */
  referenceDate: string
): BreakdownMonthlyStats {
  const days = parseDateOnly(monthEnd(referenceDate)).getUTCDate();
  const units = Math.max(1, unitCount);
  const availableHours = days * 24 * units;
  const now = new Date();

  let totalDowntimeHours = 0;
  let totalMaintenanceCost = 0;
  let openCount = 0;
  let closedCount = 0;

  for (const r of rows) {
    totalMaintenanceCost += r.maintenanceCost ?? 0;
    if (isBreakdownActive(r, now)) openCount += 1;
    else closedCount += 1;
    if (r.downtimeHours != null) {
      totalDowntimeHours += r.downtimeHours;
    } else if (r.endTime == null) {
      // Open-ended: count downtime elapsed so far
      totalDowntimeHours += Math.max(
        0,
        (now.getTime() - r.startTime.getTime()) / 3_600_000
      );
    }
  }

  const capped = Math.min(totalDowntimeHours, availableHours);
  const availabilityPercent =
    availableHours > 0
      ? ((availableHours - capped) / availableHours) * 100
      : 100;

  return {
    periodLabel: monthLabel(monthStart(referenceDate)),
    totalDowntimeHours: Math.round(totalDowntimeHours * 100) / 100,
    totalMaintenanceCost,
    openCount,
    closedCount,
    unitCount: units,
    availabilityPercent: Math.round(availabilityPercent * 10) / 10,
    availableHours,
  };
}
