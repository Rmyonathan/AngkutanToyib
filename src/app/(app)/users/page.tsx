import { redirect } from "next/navigation";
import { UsersClient } from "@/components/users/users-client";
import { requireSession } from "@/lib/auth/session";
import { canAccessUsers, permissionsForRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requireSession();
  if (!canAccessUsers(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const [users, lastActivity, customRoles] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      _max: { timestamp: true },
    }),
    prisma.rolePermission.findMany({ select: { role: true } }),
  ]);
  const custom = new Set(customRoles.map((r) => r.role));
  const editableRoles = ["MANAGER", "ADMIN", "FINANCE", "OPERATOR"] as const;
  const lastByUser = new Map(
    lastActivity.map((a) => [a.userId, a._max.timestamp])
  );

  return (
    <UsersClient
      currentUserId={session.user.id}
      currentRole={session.user.role}
      rolePermissions={editableRoles.map((role) => ({
        role,
        permissions: [...permissionsForRole(role)],
        isCustom: custom.has(role),
      }))}
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        lastActivity: lastByUser.get(u.id)?.toISOString() ?? null,
      }))}
    />
  );
}
