import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { canAccessOperationsArea, canViewFuel } from "@/lib/auth/rbac";

export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  if (
    !canAccessOperationsArea(session.user.role) &&
    !canViewFuel(session.user.role)
  ) {
    redirect("/dashboard?error=forbidden");
  }
  return <>{children}</>;
}
