import { KasKeseluruhanView } from "@/components/finance/kas-keseluruhan-view";
import { requireSession } from "@/lib/auth/session";
import { canWriteHpp } from "@/lib/auth/rbac";
import { getFinancialHppData } from "@/lib/finance/get-financial-hpp";
import { getReceivablesSummary } from "@/lib/finance/receivables";

export const dynamic = "force-dynamic";

export default async function KasKeseluruhanPage() {
  const session = await requireSession();
  const canWrite = canWriteHpp(session.user.role);
  const [data, receivables] = await Promise.all([
    getFinancialHppData(),
    getReceivablesSummary(),
  ]);
  return (
    <KasKeseluruhanView
      data={data}
      receivables={receivables}
      canWrite={canWrite}
    />
  );
}
