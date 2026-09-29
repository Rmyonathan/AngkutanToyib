"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finance/buku-harian", label: "Buku Harian" },
  { href: "/finance/profitabilitas", label: "Profitabilitas Unit" },
  { href: "/finance/kas", label: "Kas Keseluruhan" },
  { href: "/finance/piutang", label: "Penagihan & Piutang" },
  { href: "/finance/pembayaran", label: "Riwayat Pembayaran" },
] as const;

export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-px print:hidden">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
