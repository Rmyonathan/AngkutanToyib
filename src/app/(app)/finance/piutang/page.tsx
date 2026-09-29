import { redirect } from "next/navigation";
import { PiutangClient } from "@/components/finance/piutang-client";
import { requireSession } from "@/lib/auth/session";
import { canAccessFinance, canManageBilling } from "@/lib/auth/rbac";
import { getReceivables } from "@/lib/finance/receivables";

export const dynamic = "force-dynamic";

export default async function PiutangPage() {
  const session = await requireSession();
  if (!canAccessFinance(session.user.role)) redirect("/dashboard?error=forbidden");

  const data = await getReceivables();
  return (
    <PiutangClient data={data} canWrite={canManageBilling(session.user.role)} />
  );
}
