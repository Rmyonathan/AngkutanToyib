import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";

export default async function HppSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  if (
    !hasPermission(session.user.role, "hpp:read") &&
    !hasPermission(session.user.role, "hpp:write")
  ) {
    redirect("/dashboard?error=forbidden");
  }
  return <>{children}</>;
}
