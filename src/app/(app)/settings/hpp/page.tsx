import { CostsClient } from "@/components/masters/costs-client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { canWriteHpp, hasPermission } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * HPP Settings — edit flexible cost variables (solar, ban, maintenance, etc.)
 * Separate from Master HPP (financial ledger view).
 */
export default async function HppSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const canRead =
    hasPermission(session.user.role, "hpp:read") ||
    hasPermission(session.user.role, "hpp:write") ||
    hasPermission(session.user.role, "*");

  if (!canRead) redirect("/dashboard?error=forbidden");

  const canWrite = canWriteHpp(session.user.role);

  const config = await prisma.masterCostConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <CostsClient
      canWrite={canWrite}
      config={
        config
          ? {
              id: config.id,
              name: config.name,
              isActive: config.isActive,
              globalSolarPrice: config.globalSolarPrice,
              globalTirePrice: config.globalTirePrice,
              tireLifespanDays: config.tireLifespanDays,
              defaultMaintenanceBudget: config.defaultMaintenanceBudget,
              defaultCicilan: config.defaultCicilan,
              defaultDepreciation: config.defaultDepreciation,
              defaultMovingCost: config.defaultMovingCost,
              estimatedOpsDaysPerMonth: config.estimatedOpsDaysPerMonth,
            }
          : null
      }
    />
  );
}
