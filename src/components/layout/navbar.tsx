"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { ChevronDown, LogOut, Menu, Settings, Truck, X } from "lucide-react";
import { grantsPermission, type AppRole, type Permission } from "@/lib/auth/rbac";
import { NAV_ITEMS, ROLE_LABELS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { COMPANY_NAME, COMPANY_TAGLINE } from "@/lib/company";
import { Button } from "@/components/ui/button";

type NavbarProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role: AppRole;
    permissions: Permission[];
  };
};

function canSeeItem(grants: Permission[], item: NavItem): boolean {
  if (item.matchAny?.length) {
    return item.matchAny.some((p) => grantsPermission(grants, p));
  }
  if (item.permission) {
    return grantsPermission(grants, item.permission);
  }
  return false;
}

function visibleChildren(
  grants: Permission[],
  item: NavItem,
  role: AppRole
) {
  if (!item.children) return [];
  return item.children.filter((child) => {
    if (child.ownerOnly && role !== "OWNER") return false;
    if (!child.permission) return true;
    return grantsPermission(grants, child.permission);
  });
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const visible = useMemo(() => {
    return NAV_ITEMS.map((item) => {
      if (!canSeeItem(user.permissions, item)) return null;
      if (item.children) {
        const children = visibleChildren(user.permissions, item, user.role);
        if (children.length === 0) return null;
        return { ...item, children };
      }
      return item;
    }).filter(Boolean) as NavItem[];
  }, [user.permissions, user.role]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isGroupActive(item: NavItem) {
    return isActive(item.href) || (item.children ?? []).some((c) => isActive(c.href));
  }

  const activeCls = "bg-neutral-900 text-white";
  const idleCls =
    "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={grantsPermission(user.permissions, "dashboard") ? "/dashboard" : "/upload"}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Truck className="h-4 w-4" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {COMPANY_TAGLINE}
            </span>
            <span className="block text-sm font-bold leading-tight text-neutral-900">
              {COMPANY_NAME}
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {visible.map((item) =>
            item.children ? (
              <div
                key={item.href}
                className={cn("relative", item.alignEnd && "ml-auto")}
                onMouseEnter={() => setOpenGroup(item.href)}
                onMouseLeave={() => setOpenGroup(null)}
              >
                <button
                  type="button"
                  aria-label={item.label}
                  title={item.icon ? item.label : undefined}
                  onClick={() => setOpenGroup((g) => (g === item.href ? null : item.href))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isGroupActive(item) ? activeCls : idleCls
                  )}
                >
                  {item.icon === "settings" ? <Settings className="h-4 w-4" /> : item.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {openGroup === item.href && (
                  <div
                    className={cn(
                      "absolute top-full z-50 min-w-[220px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg",
                      item.alignEnd ? "right-0" : "left-0"
                    )}
                  >
                    {item.icon && (
                      <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        {item.label}
                      </p>
                    )}
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpenGroup(null)}
                        className={cn(
                          "block px-3 py-2 text-sm hover:bg-neutral-50",
                          isActive(child.href)
                            ? "font-semibold text-neutral-900"
                            : "text-neutral-700"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(item.href) ? activeCls : idleCls
                )}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-neutral-900">
              {user.name ?? "User"}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Logout
          </Button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-100 bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {visible.map((item) =>
              item.children ? (
                <div key={item.href} className="space-y-1">
                  <p className="flex items-center gap-1.5 px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {item.icon === "settings" && <Settings className="h-3 w-3" />}
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm",
                        isActive(child.href)
                          ? "bg-neutral-900 font-semibold text-white"
                          : "text-neutral-700"
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    isActive(item.href)
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700"
                  )}
                >
                  {item.label}
                </Link>
              )
            )}
            <button
              type="button"
              className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-900"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Logout ({ROLE_LABELS[user.role]})
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
