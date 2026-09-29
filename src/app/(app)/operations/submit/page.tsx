import { redirect } from "next/navigation";

export default function LegacySubmitRedirect() {
  redirect("/upload");
}
