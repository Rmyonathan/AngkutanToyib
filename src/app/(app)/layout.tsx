import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { permissionsForRole, type AppRole } from "@/lib/auth/rbac";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role as AppRole,
        permissions: [...permissionsForRole(session.user.role)],
      }}
    >
      {children}
    </AppShell>
  );
}
