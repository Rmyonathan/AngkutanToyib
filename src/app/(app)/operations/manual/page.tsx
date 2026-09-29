import { redirect } from "next/navigation";

/** Manual DO replaced by Data Trip DO */
export default function LegacyManualPage() {
  redirect("/operations/trips");
}
