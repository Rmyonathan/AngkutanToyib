import { BukuHarianView } from "@/components/finance/buku-harian-view";
import { getFinancialHppData } from "@/lib/finance/get-financial-hpp";

export const dynamic = "force-dynamic";

export default async function BukuHarianPage() {
  const data = await getFinancialHppData();
  return <BukuHarianView data={data} />;
}
