import { DeliveryOrderStatus } from "@prisma/client";

/**
 * Alur:
 *   Supir upload foto (pilih trip) → Admin verifikasi & input netto/tiket/solar
 *   → DO dibuat (VERIFIED) → INVOICED → COMPLETED
 *
 * VERIFIED  = DO sudah dibuat dari upload supir (netto dari tiket timbangan).
 * INVOICED  = sudah masuk invoice ke customer (piutang berjalan / tempo).
 * COMPLETED = invoice lunas (pembayaran + PPh 23 ≥ total tagihan).
 */

export const DO_STATUS_LABEL: Record<DeliveryOrderStatus, string> = {
  VERIFIED: "Verified",
  INVOICED: "Sudah Ditagih",
  COMPLETED: "Lunas",
};

/**
 * Netto sudah terverifikasi → dihitung sebagai revenue (accrual) / tonase
 * di dashboard, buku harian, profitabilitas, laporan.
 * Kas masuk baru terjadi saat pembayaran invoice dicatat.
 */
export const DO_REVENUE_STATUSES: DeliveryOrderStatus[] = [
  DeliveryOrderStatus.VERIFIED,
  DeliveryOrderStatus.INVOICED,
  DeliveryOrderStatus.COMPLETED,
];

/** DO yang bisa ditarik ke invoice (sudah verified, belum di-invoice). */
export const DO_INVOICEABLE_STATUSES: DeliveryOrderStatus[] = [
  DeliveryOrderStatus.VERIFIED,
];

/**
 * DO boleh dikoreksi di semua status. Yang sudah masuk invoice: total invoice
 * ikut dihitung ulang (lihat updateDoTrip).
 */
export const DO_EDITABLE_STATUSES: DeliveryOrderStatus[] = [
  DeliveryOrderStatus.VERIFIED,
  DeliveryOrderStatus.INVOICED,
  DeliveryOrderStatus.COMPLETED,
];

export function isDoRevenue(status: DeliveryOrderStatus) {
  return DO_REVENUE_STATUSES.includes(status);
}

export function isDoEditable(status: DeliveryOrderStatus) {
  return DO_EDITABLE_STATUSES.includes(status);
}
