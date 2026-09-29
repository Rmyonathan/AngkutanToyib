import { redirect } from "next/navigation";

/** Legacy Master HPP → Keuangan / Buku Harian */
export default function LegacyMasterHppPage() {
  redirect("/finance/buku-harian");
}
