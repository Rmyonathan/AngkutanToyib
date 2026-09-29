import { prisma } from "@/lib/prisma";
import {
  PERMISSION_CATALOG,
  permissionsForRole,
  setRolePermissionOverrides,
  type AppRole,
  type Permission,
} from "@/lib/auth/rbac";

const TTL_MS = 10_000;
let loadedAt = 0;
let inflight: Promise<void> | null = null;

const VALID = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));

export function sanitizePermissions(list: string[]): Permission[] {
  return Array.from(new Set(list.filter((p) => VALID.has(p)))) as Permission[];
}

/** Refresh the in-memory role → permissions map from DB (cached briefly). */
export async function loadRolePermissions(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rows = await prisma.rolePermission.findMany();
      const map: Partial<Record<AppRole, readonly Permission[]>> = {};
      for (const r of rows) {
        if (r.role === "OWNER") continue;
        map[r.role] = sanitizePermissions(r.permissions);
      }
      setRolePermissionOverrides(map);
      loadedAt = Date.now();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getPermissionsForRole(role: string): Promise<Permission[]> {
  await loadRolePermissions();
  return [...permissionsForRole(role)];
}
