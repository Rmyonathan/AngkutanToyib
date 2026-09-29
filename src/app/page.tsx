import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/rbac";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  redirect(homePathForRole(session.user.role));
}
