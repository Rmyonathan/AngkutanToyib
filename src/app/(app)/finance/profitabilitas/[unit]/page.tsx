import { notFound } from "next/navigation";
import { UnitProfitDetailView } from "@/components/finance/unit-profit-detail-view";
import { getUnitProfitDetail } from "@/lib/finance/get-financial-hpp";

export const dynamic = "force-dynamic";

export default async function UnitProfitDetailPage({
  params,
}: {
  params: { unit: string };
}) {
  const unitNumber = decodeURIComponent(params.unit);
  const data = await getUnitProfitDetail(unitNumber);
  if (!data) notFound();
  return <UnitProfitDetailView data={data} />;
}
