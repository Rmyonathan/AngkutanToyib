import { redirect } from "next/navigation";

/** Legacy arsip — verification inbox is enough for MVP */
export default function LegacyArsipPage() {
  redirect("/operations/verify");
}
