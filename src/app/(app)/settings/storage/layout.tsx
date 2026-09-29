import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/rbac";

export default async function StorageSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.user.role !== ROLES.OWNER) {
    redirect("/dashboard?error=forbidden");
  }
  return <>{children}</>;
}
