import type { AppRole, Permission } from "@/lib/auth/rbac";

export type NavChild = {
  href: string;
  label: string;
  permission?: Permission;
};

export type NavItem = {
  href: string;
  label: string;
  permission?: Permission;
  matchAny?: Permission[];
  children?: NavChild[];
  /** Icon-only trigger (label still used for a11y + mobile) */
  icon?: "settings";
  /** Push to the right edge of the desktop nav */
  alignEnd?: boolean;
};

/**
 * OPERATOR → Operasional › Upload Dokumen only.
 * Settings (gear) groups HPP Settings, Audit Trail and Users.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    permission: "dashboard",
  },
  {
    href: "/operations",
    label: "Operasional",
    matchAny: ["field:submit", "ops:verify", "ops:manual", "operations:write", "operations:read", "fuel:read"],
    children: [
      {
        href: "/upload",
        label: "Upload Dokumen",
        permission: "field:submit",
      },
      {
        href: "/operations/verify",
        label: "Verifikasi Dokumen",
        permission: "ops:verify",
      },
      {
        href: "/operations/trips",
        label: "Data DO",
        permission: "operations:read",
      },
      {
        href: "/operations/solar",
        label: "Konsumsi Solar",
        permission: "fuel:read",
      },
    ],
  },
  {
    href: "/masters",
    label: "Master Data",
    permission: "masters:read",
    children: [
      { href: "/masters/units", label: "Master Unit" },
      { href: "/masters/drivers", label: "Master Driver" },
      { href: "/masters/customers", label: "Master Customer" },
    ],
  },
  {
    href: "/finance",
    label: "Keuangan",
    matchAny: ["hpp:read", "hpp:write", "billing:write"],
    children: [
      { href: "/finance/buku-harian", label: "Buku Harian" },
      { href: "/finance/profitabilitas", label: "Profitabilitas Unit" },
      { href: "/finance/kas", label: "Kas Keseluruhan" },
      { href: "/finance/piutang", label: "Penagihan & Piutang" },
      { href: "/finance/pembayaran", label: "Riwayat Pembayaran" },
    ],
  },
  {
    href: "/breakdown",
    label: "Breakdown",
    permission: "breakdown:read",
  },
  {
    href: "/reports",
    label: "Laporan",
    permission: "reports",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    alignEnd: true,
    matchAny: ["hpp:read", "audit", "users"],
    children: [
      { href: "/settings/hpp", label: "HPP Settings", permission: "hpp:read" },
      { href: "/audit", label: "Audit Trail", permission: "audit" },
      { href: "/users", label: "Users & Role", permission: "users" },
    ],
  },
];

export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  ADMIN: "Admin",
  OPERATOR: "Supir / Operator",
  FINANCE: "Finance",
};
