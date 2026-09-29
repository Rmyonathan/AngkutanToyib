import { MastersTabs } from "@/components/masters/masters-tabs";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessMasters } from "@/lib/auth/rbac";

export default async function MastersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  if (!canAccessMasters(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  return (
    <div>
      <MastersTabs />
      {children}
    </div>
  );
}
