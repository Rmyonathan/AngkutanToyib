import { Navbar } from "@/components/layout/navbar";
import type { AppRole, Permission } from "@/lib/auth/rbac";

type AppShellProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role: AppRole;
    permissions: Permission[];
  };
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar user={user} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
