import { DeliveryOrderStatus, InvoiceStatus, type Prisma } from "@prisma/client";

/** Rupiah rounding tolerance when deciding "lunas" */
export const INVOICE_TOLERANCE = 1;

/**
 * Recompute invoice totals from its DOs (tonase × rate) and status from
 * payments. Invoice PAID → all its DOs COMPLETED; otherwise DOs stay INVOICED.
 * Throws if the new total would fall below what was already paid.
 */
export async function recalcInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      payments: { select: { amount: true, withholdingAmount: true } },
      deliveryOrders: { select: { netto: true, ratePerTon: true } },
    },
  });
  if (inv.status === InvoiceStatus.CANCELLED) return inv;

  const totalTonase =
    Math.round(inv.deliveryOrders.reduce((s, d) => s + (d.netto ?? 0), 0) * 1000) / 1000;
  const totalAmount = Math.round(
    inv.deliveryOrders.reduce((s, d) => s + (d.netto ?? 0) * d.ratePerTon, 0)
  );
  const paidAmount = inv.payments.reduce((s, p) => s + p.amount, 0);
  const withholdingAmount = inv.payments.reduce((s, p) => s + p.withholdingAmount, 0);
  const settled = paidAmount + withholdingAmount;
  if (settled > totalAmount + INVOICE_TOLERANCE) {
    throw new Error(
      `Total invoice ${inv.invoiceNumber} jadi Rp ${totalAmount.toLocaleString("id-ID")}, ` +
        `lebih kecil dari yang sudah dibayar (Rp ${Math.round(settled).toLocaleString("id-ID")}). ` +
        "Hapus / koreksi pembayaran dulu."
    );
  }
  const status =
    settled >= totalAmount - INVOICE_TOLERANCE
      ? InvoiceStatus.PAID
      : settled > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.ISSUED;

  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      totalTonase,
      totalAmount,
      ratePerTon: totalTonase > 0 ? totalAmount / totalTonase : 0,
      paidAmount,
      withholdingAmount,
      status,
    },
  });
  await tx.deliveryOrder.updateMany({
    where: { invoiceId },
    data: {
      status:
        status === InvoiceStatus.PAID
          ? DeliveryOrderStatus.COMPLETED
          : DeliveryOrderStatus.INVOICED,
    },
  });
  return updated;
}
