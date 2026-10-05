"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/reports", label: "Laporan Operasional" },
  { href: "/reports/gaji-driver", label: "Gaji Driver" },
] as const;

export function ReportsNav() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/reports" ? path === "/reports" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
