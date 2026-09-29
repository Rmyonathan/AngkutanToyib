"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Periodic refetch rewrites the JWT cookie, so role / permission changes
  // made in /users reach the middleware within a minute.
  return <SessionProvider refetchInterval={60}>{children}</SessionProvider>;
}
