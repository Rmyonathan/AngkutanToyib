import { redirect } from "next/navigation";
import { PaymentHistoryView } from "@/components/finance/payment-history-view";
import { requireSession } from "@/lib/auth/session";
import { canAccessFinance } from "@/lib/auth/rbac";
import { getPaymentHistory } from "@/lib/finance/receivables";
import { monthStart, todayDateOnly, tryParseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

function dateParam(v: string | undefined, fallback: string): string {
  return v && tryParseDateOnly(v) ? v.slice(0, 10) : fallback;
}

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; customerId?: string; method?: string };
}) {
  const session = await requireSession();
  if (!canAccessFinance(session.user.role)) redirect("/dashboard?error=forbidden");

  const today = todayDateOnly();
  const from = dateParam(searchParams.from, monthStart(today));
  let to = dateParam(searchParams.to, today);
  if (to < from) to = from;

  const data = await getPaymentHistory({
    from,
    to,
    customerId: searchParams.customerId || null,
    method: searchParams.method || null,
  });

  return <PaymentHistoryView data={data} today={today} />;
}
