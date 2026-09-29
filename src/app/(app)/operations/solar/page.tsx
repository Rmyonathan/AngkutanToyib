import { redirect } from "next/navigation";
import { FuelConsumptionView } from "@/components/operations/fuel-consumption-view";
import { requireSession } from "@/lib/auth/session";
import { canViewFuel } from "@/lib/auth/rbac";
import { getFuelConsumption } from "@/lib/operations/fuel-consumption";
import { monthStart, todayDateOnly, tryParseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

function dateParam(v: string | undefined, fallback: string): string {
  return v && tryParseDateOnly(v) ? v.slice(0, 10) : fallback;
}

export default async function FuelConsumptionPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; unitId?: string; threshold?: string };
}) {
  const session = await requireSession();
  if (!canViewFuel(session.user.role)) redirect("/dashboard?error=forbidden");

  const today = todayDateOnly();
  const from = dateParam(searchParams.from, monthStart(today));
  let to = dateParam(searchParams.to, today);
  if (to < from) to = from;
  const threshold = Math.min(100, Math.max(5, Number(searchParams.threshold) || 15));

  const data = await getFuelConsumption({
    from,
    to,
    unitId: searchParams.unitId || null,
    thresholdPercent: threshold,
  });

  return <FuelConsumptionView data={data} today={today} />;
}
