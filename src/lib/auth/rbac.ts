/** Edge-safe role constants (no Prisma import — usable in middleware) */
export const ROLES = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  FINANCE: "FINANCE",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export type Permission =
  | "*"
  | "dashboard"
  | "operations:write"
  | "operations:read"
  | "field:submit"
  | "ops:verify"
  | "ops:manual"
  | "masters:write"
  | "masters:read"
  | "breakdown:write"
  | "breakdown:read"
  | "hpp:write"
  | "hpp:read"
  | "billing:write"
  | "fuel:read"
  | "reports"
  | "audit"
  | "users";

export type PermissionInfo = {
  key: Exclude<Permission, "*">;
  label: string;
  description: string;
  group: string;
  /** Enabling this permission also enables these */
  implies?: Exclude<Permission, "*">[];
};

/** Everything an Owner can grant to other roles in /users → Hak Akses Role */
export const PERMISSION_CATALOG: PermissionInfo[] = [
  { key: "dashboard", group: "Umum", label: "Owner Dashboard", description: "Lihat dashboard: produksi, revenue, HPP, profit" },
  { key: "reports", group: "Umum", label: "Laporan", description: "Buka laporan & export Excel/PDF" },
  { key: "fuel:read", group: "Umum", label: "Konsumsi Solar", description: "Lihat analisa konsumsi solar per unit" },
  { key: "field:submit", group: "Operasional", label: "Upload dokumen lapangan", description: "Supir pilih trip lalu upload foto Surat Jalan (+ nota solar / biaya lain)" },
  { key: "operations:read", group: "Operasional", label: "Lihat Data DO", description: "Lihat daftar & detail DO" },
  { key: "operations:write", group: "Operasional", label: "Edit DO", description: "Ubah data DO (unit, driver, trip, netto, tiket, KM) sebelum ditagih", implies: ["operations:read"] },
  { key: "ops:manual", group: "Operasional", label: "Input trip manual", description: "Input ritase tanpa foto", implies: ["operations:read"] },
  { key: "ops:verify", group: "Operasional", label: "Verifikasi / approve dokumen", description: "Cek foto upload supir, input netto / solar / biaya lain → DO dibuat", implies: ["operations:read"] },
  { key: "breakdown:read", group: "Operasional", label: "Lihat Breakdown", description: "Lihat riwayat breakdown unit" },
  { key: "breakdown:write", group: "Operasional", label: "Input Breakdown", description: "Catat / ubah breakdown & biaya perbaikan", implies: ["breakdown:read"] },
  { key: "masters:read", group: "Master Data", label: "Lihat Master Data", description: "Lihat unit, driver, customer" },
  { key: "masters:write", group: "Master Data", label: "Ubah Master Data", description: "Tambah / ubah / hapus unit, driver, customer (termasuk tarif)", implies: ["masters:read"] },
  { key: "hpp:read", group: "Keuangan", label: "Lihat Keuangan & HPP", description: "Buku harian, profitabilitas, kas, piutang, HPP Settings" },
  { key: "hpp:write", group: "Keuangan", label: "Ubah HPP & Jurnal Kas", description: "Ubah HPP Settings, input / hapus jurnal kas", implies: ["hpp:read"] },
  { key: "billing:write", group: "Keuangan", label: "Penagihan & Pembayaran", description: "Buat / batalkan invoice, catat & hapus pembayaran customer", implies: ["hpp:read"] },
  { key: "audit", group: "Sistem", label: "Audit Trail", description: "Lihat riwayat perubahan data" },
  { key: "users", group: "Sistem", label: "Kelola User & Role", description: "Tambah user, reset password, ubah hak akses role (sangat sensitif)" },
];

/** Default hak akses — dipakai bila Owner belum mengubah role tsb. */
export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  OWNER: ["*"],
  MANAGER: [
    "dashboard",
    "operations:read",
    "ops:verify",
    "masters:read",
    "breakdown:read",
    "hpp:read",
    "fuel:read",
    "reports",
    "audit",
  ],
  ADMIN: [
    "dashboard",
    "operations:write",
    "operations:read",
    "field:submit",
    "ops:verify",
    "ops:manual",
    "masters:write",
    "masters:read",
    "breakdown:write",
    "breakdown:read",
    "fuel:read",
    "reports",
    "audit",
  ],
  OPERATOR: ["field:submit"],
  FINANCE: [
    "dashboard",
    "hpp:write",
    "hpp:read",
    "billing:write",
    "fuel:read",
    "reports",
    "operations:read",
    "masters:read",
  ],
};

let overrides: Partial<Record<AppRole, readonly Permission[]>> = {};

/**
 * Server: loaded from DB (role_permissions) by loadRolePermissions().
 * Middleware: set from the JWT for the current user's role.
 */
export function setRolePermissionOverrides(
  map: Partial<Record<AppRole, readonly Permission[]>>
) {
  overrides = map;
}

export function permissionsForRole(role: string): readonly Permission[] {
  if (role === ROLES.OWNER) return ["*"];
  return overrides[role as AppRole] ?? DEFAULT_ROLE_PERMISSIONS[role as AppRole] ?? [];
}

export function grantsPermission(
  grants: readonly Permission[],
  permission: Permission
): boolean {
  return grants.includes("*") || grants.includes(permission);
}

export function hasPermission(role: string, permission: Permission): boolean {
  return grantsPermission(permissionsForRole(role), permission);
}

export function canWriteHpp(role: string): boolean {
  return hasPermission(role, "hpp:write");
}

export function canViewDashboard(role: string): boolean {
  return hasPermission(role, "dashboard");
}

export function canAccessMasters(role: string): boolean {
  return hasPermission(role, "masters:read") || hasPermission(role, "masters:write");
}

export function canAccessReports(role: string): boolean {
  return hasPermission(role, "reports");
}

export function canAccessAudit(role: string): boolean {
  return hasPermission(role, "audit");
}

export function canAccessUsers(role: string): boolean {
  return hasPermission(role, "users");
}

export function canAccessBreakdown(role: string): boolean {
  return (
    hasPermission(role, "breakdown:read") ||
    hasPermission(role, "breakdown:write")
  );
}

/** Supir upload dokumen lapangan */
export function canSubmitFieldDocs(role: string): boolean {
  return hasPermission(role, "field:submit");
}

/** Admin verifikasi foto → buat DO + OperationalCost */
export function canVerifyFieldDocs(role: string): boolean {
  return hasPermission(role, "ops:verify");
}

/** Edit DO */
export function canManageTrips(role: string): boolean {
  return (
    hasPermission(role, "operations:write") ||
    hasPermission(role, "ops:manual") ||
    hasPermission(role, "*")
  );
}

/** Input ritase manual tanpa foto */
export function canManualDailyOps(role: string): boolean {
  return hasPermission(role, "ops:manual");
}

/** Legacy helper — admin-side ops write (not for OPERATOR) */
export function canWriteDailyOps(role: string): boolean {
  return (
    canVerifyFieldDocs(role) ||
    canManualDailyOps(role) ||
    hasPermission(role, "operations:write")
  );
}

export function canAccessOperationsArea(role: string): boolean {
  return (
    canSubmitFieldDocs(role) ||
    canVerifyFieldDocs(role) ||
    canManualDailyOps(role) ||
    hasPermission(role, "operations:read")
  );
}

/** Buat invoice, catat pembayaran customer */
export function canManageBilling(role: string): boolean {
  return hasPermission(role, "billing:write");
}

export function canAccessFinance(role: string): boolean {
  return (
    hasPermission(role, "hpp:read") ||
    hasPermission(role, "hpp:write") ||
    hasPermission(role, "billing:write")
  );
}

export function canViewFuel(role: string): boolean {
  return hasPermission(role, "fuel:read");
}

export function homePathForRole(role: string): string {
  if (role === ROLES.OPERATOR) return "/upload";
  if (canViewDashboard(role)) return "/dashboard";
  if (canSubmitFieldDocs(role)) return "/upload";
  return "/login";
}
