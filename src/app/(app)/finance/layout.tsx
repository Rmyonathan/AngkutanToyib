import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { requireSession } from "@/lib/auth/session";
import { canAccessFinance } from "@/lib/auth/rbac";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  if (!canAccessFinance(session.user.role)) redirect("/dashboard?error=forbidden");

  return (
    <div>
      <FinanceTabs />
      {children}
    </div>
  );
}
