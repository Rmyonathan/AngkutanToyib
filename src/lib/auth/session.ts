import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { loadRolePermissions } from "@/lib/auth/role-permissions";

export async function getCurrentSession() {
  const [session] = await Promise.all([
    getServerSession(authOptions),
    loadRolePermissions(),
  ]);
  return session;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
