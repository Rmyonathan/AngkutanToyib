import { ProfitabilitasView } from "@/components/finance/profitabilitas-view";
import { getFinancialHppData } from "@/lib/finance/get-financial-hpp";

export const dynamic = "force-dynamic";

export default async function ProfitabilitasPage() {
  const data = await getFinancialHppData();
  return <ProfitabilitasView data={data} />;
}
