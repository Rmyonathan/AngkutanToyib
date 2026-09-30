import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import {
  canAccessAudit,
  canAccessBreakdown,
  canAccessFinance,
  canAccessMasters,
  canAccessOperationsArea,
  canAccessReports,
  canAccessUsers,
  canManageTrips,
  canSubmitFieldDocs,
  canVerifyFieldDocs,
  canViewDashboard,
  canViewFuel,
  hasPermission,
  homePathForRole,
  setRolePermissionOverrides,
  type Permission,
} from "@/lib/auth/rbac";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const tokenPermissions = req.nextauth.token?.permissions;
    if (Array.isArray(tokenPermissions)) {
      setRolePermissionOverrides({
        [role]: tokenPermissions as Permission[],
      });
    }

    const forbidden = () =>
      NextResponse.redirect(
        new URL(`${homePathForRole(role)}?error=forbidden`, req.url)
      );

    // Konsumsi Solar only needs fuel:read, not the general operations permissions
    if (path.startsWith("/operations/solar")) {
      return canViewFuel(role) ? NextResponse.next() : forbidden();
    }

    if (path.startsWith("/upload") && !canSubmitFieldDocs(role)) {
      return forbidden();
    }

    if (path.startsWith("/operations/trips")) {
      if (
        !hasPermission(role, "operations:read") &&
        !canManageTrips(role) &&
        !canVerifyFieldDocs(role)
      ) {
        return forbidden();
      }
    }

    if (path.startsWith("/operations/verify") && !canVerifyFieldDocs(role)) {
      return forbidden();
    }

    // Legacy upload routes → new /upload
    if (path.startsWith("/operations/submit")) {
      if (!canSubmitFieldDocs(role)) return forbidden();
      return NextResponse.redirect(new URL("/upload", req.url));
    }

    if (path.startsWith("/operations/manual") && !canManageTrips(role)) {
      return forbidden();
    }

    if (path === "/operations" || path === "/operations/") {
      if (canVerifyFieldDocs(role) || hasPermission(role, "operations:read")) {
        return NextResponse.redirect(new URL("/operations/trips", req.url));
      }
      if (canSubmitFieldDocs(role)) {
        return NextResponse.redirect(new URL("/upload", req.url));
      }
      return forbidden();
    }

    if (path.startsWith("/operations") && !canAccessOperationsArea(role)) {
      return forbidden();
    }

    if (
      path.startsWith("/settings/hpp") &&
      !hasPermission(role, "hpp:read") &&
      !hasPermission(role, "hpp:write")
    ) {
      return forbidden();
    }

    if (path.startsWith("/finance") && !canAccessFinance(role)) {
      return forbidden();
    }

    if (path.startsWith("/dashboard") && !canViewDashboard(role)) {
      return NextResponse.redirect(new URL(homePathForRole(role), req.url));
    }

    if (path.startsWith("/masters") && !canAccessMasters(role)) {
      return forbidden();
    }

    if (path.startsWith("/breakdown") && !canAccessBreakdown(role)) {
      return forbidden();
    }

    if (path.startsWith("/reports") && !canAccessReports(role)) {
      return forbidden();
    }

    if (path.startsWith("/audit") && !canAccessAudit(role)) {
      return forbidden();
    }

    if (path.startsWith("/users") && !canAccessUsers(role)) {
      return forbidden();
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token?.id || token?.sub),
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload",
    "/upload/:path*",
    "/operations/:path*",
    "/finance",
    "/finance/:path*",
    "/settings/:path*",
    "/masters/:path*",
    "/breakdown/:path*",
    "/reports/:path*",
    "/audit/:path*",
    "/users/:path*",
  ],
};
