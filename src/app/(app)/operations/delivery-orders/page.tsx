import { redirect } from "next/navigation";

/** Legacy — use /operations/trips */
export default function LegacyDeliveryOrdersPage() {
  redirect("/operations/trips");
}
