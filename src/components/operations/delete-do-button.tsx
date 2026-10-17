"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDeliveryOrder } from "@/actions/trips";
import { Button } from "@/components/ui/button";

export function DeleteDoButton({
  id,
  internalTripId,
  invoiceNumber,
}: {
  id: string;
  internalTripId: string;
  invoiceNumber: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const warn = invoiceNumber
      ? `DO ${internalTripId} sudah masuk invoice ${invoiceNumber}. Total invoice akan dihitung ulang. `
      : "";
    const ok = window.confirm(
      `${warn}Hapus DO ${internalTripId} permanen? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteDeliveryOrder(id);
      if (!res.success) {
        window.alert(res.error);
        return;
      }
      router.push("/operations/trips");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={onDelete}
      className="border-red-200 text-red-700 hover:bg-red-50"
    >
      {pending ? "Menghapus…" : "Hapus DO"}
    </Button>
  );
}
