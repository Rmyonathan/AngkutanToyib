import { notFound, redirect } from "next/navigation";
import { InvoiceDetailClient } from "@/components/finance/invoice-detail-client";
import { requireSession } from "@/lib/auth/session";
import { canAccessFinance, canManageBilling } from "@/lib/auth/rbac";
import { getInvoiceDetail } from "@/lib/finance/receivables";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  const session = await requireSession();
  if (!canAccessFinance(session.user.role)) redirect("/dashboard?error=forbidden");

  const invoice = await getInvoiceDetail(params.id);
  if (!invoice) notFound();

  const back =
    searchParams.from === "pembayaran"
      ? { href: "/finance/pembayaran", label: "Riwayat Pembayaran" }
      : { href: "/finance/piutang", label: "Penagihan & Piutang" };

  return (
    <InvoiceDetailClient
      invoice={invoice}
      canWrite={canManageBilling(session.user.role)}
      back={back}
    />
  );
}
