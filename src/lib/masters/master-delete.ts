import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MasterDeleteBlockers = {
  deliveryOrders: number;
  fieldSubmissions: number;
  operationalCosts: number;
  breakdowns?: number;
};

export async function getDriverDeleteBlockers(
  driverId: string
): Promise<MasterDeleteBlockers> {
  const [deliveryOrders, fieldSubmissions, operationalCosts] =
    await Promise.all([
      prisma.deliveryOrder.count({ where: { driverId } }),
      prisma.fieldSubmission.count({ where: { driverId } }),
      prisma.operationalCost.count({ where: { driverId } }),
    ]);
  return { deliveryOrders, fieldSubmissions, operationalCosts };
}

export async function getUnitDeleteBlockers(
  unitId: string
): Promise<MasterDeleteBlockers> {
  const [deliveryOrders, fieldSubmissions, operationalCosts, breakdowns] =
    await Promise.all([
      prisma.deliveryOrder.count({ where: { unitId } }),
      prisma.fieldSubmission.count({ where: { unitId } }),
      prisma.operationalCost.count({ where: { unitId } }),
      prisma.breakdownHistory.count({ where: { unitId } }),
    ]);
  return { deliveryOrders, fieldSubmissions, operationalCosts, breakdowns };
}

function blockerMessage(
  kind: "driver" | "unit",
  b: MasterDeleteBlockers,
  ownerWillPurge: boolean
): string | null {
  if (b.deliveryOrders > 0) {
    if (kind === "driver") {
      return (
        `Supir tidak bisa dihapus: masih ada ${b.deliveryOrders} DO (trip sudah diverifikasi) di sistem.\n\n` +
        "DO & laporan keuangan tidak ikut terhapus kalau master dihapus — makanya sistem menolak.\n\n" +
        "Pilihan:\n" +
        "• Ubah Absensi supir ke INACTIVE (supir tidak dipakai lagi, riwayat DO tetap ada)\n" +
        "• Atau hapus DO yang salah di menu Operasional → Data DO (hanya Owner)"
      );
    }
    return (
      `Unit tidak bisa dihapus: masih ada ${b.deliveryOrders} DO pakai unit ini.\n\n` +
      "Riwayat trip & invoice tidak boleh hilang tanpa hapus DO dulu.\n\n" +
      "Pilihan: set status Standby, atau hapus DO yang salah (Owner) sebelum hapus unit."
    );
  }

  const extras: string[] = [];
  if (b.fieldSubmissions)
    extras.push(`${b.fieldSubmissions} upload/antrian dokumen supir`);
  if (b.operationalCosts)
    extras.push(`${b.operationalCosts} biaya operasional terkait`);
  if (b.breakdowns) extras.push(`${b.breakdowns} catatan breakdown`);

  if (extras.length === 0) return null;

  if (ownerWillPurge) return null;

  if (kind === "driver") {
    return (
      `Supir tidak bisa dihapus: masih terhubung ke ${extras.join(", ")}.\n\n` +
      "Hanya Owner yang bisa hapus bersih (upload yang belum jadi DO ikut terhapus).\n\n" +
      "Atau cukup ubah Absensi ke INACTIVE tanpa hapus master."
    );
  }
  return (
    `Unit tidak bisa dihapus: masih terhubung ke ${extras.join(", ")}.\n\n` +
    "Hanya Owner yang bisa hapus bersih (upload/breakdown yang menggantung ikut dibersihkan).\n\n" +
    "Kalau unit masih ada di lapangan, lebih aman ubah status ke Standby saja."
  );
}

export function driverDeleteError(
  b: MasterDeleteBlockers,
  isOwner: boolean
): string | null {
  return blockerMessage("driver", b, isOwner);
}

export function unitDeleteError(
  b: MasterDeleteBlockers,
  isOwner: boolean
): string | null {
  return blockerMessage("unit", b, isOwner);
}

export async function purgeDriverForDelete(
  tx: Prisma.TransactionClient,
  driverId: string
) {
  await tx.fieldSubmission.deleteMany({ where: { driverId } });
  await tx.operationalCost.deleteMany({ where: { driverId } });
  await tx.masterUnit.updateMany({
    where: { defaultDriverId: driverId },
    data: { defaultDriverId: null },
  });
}

export async function purgeUnitForDelete(
  tx: Prisma.TransactionClient,
  unitId: string
) {
  await tx.fieldSubmission.deleteMany({ where: { unitId } });
  await tx.operationalCost.deleteMany({ where: { unitId } });
  await tx.breakdownHistory.deleteMany({ where: { unitId } });
  await tx.hppJournalEntry.updateMany({
    where: { unitId },
    data: { unitId: null },
  });
}

/** Jangan tampilkan pesan teknis Prisma/Postgres ke pengguna. */
export function prismaFkMessage(err: unknown, fallback: string): string {
  const m =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const low = m.toLowerCase();

  if (low.includes("field_submission")) {
    return (
      "Masih ada upload dokumen supir yang terhubung ke data ini.\n\n" +
      "Login sebagai Owner lalu hapus lagi — upload yang belum jadi DO akan dibersihkan otomatis."
    );
  }
  if (low.includes("delivery_order")) {
    return (
      "Masih ada DO (trip terverifikasi) yang memakai data ini.\n\n" +
      "Master tidak bisa dihapus selama DO masih ada."
    );
  }
  if (low.includes("breakdown")) {
    return (
      "Masih ada riwayat breakdown unit ini.\n\n" +
      "Owner dapat menghapus bersih saat tidak ada DO."
    );
  }

  const looksTechnical =
    low.includes("connectorerror") ||
    low.includes("postgreserror") ||
    low.includes("prisma") ||
    low.includes("invocation") ||
    low.includes("violates") ||
    low.includes("foreign key") ||
    low.includes("23001") ||
    m.length > 180;

  if (looksTechnical) return fallback;
  if (m.trim()) return m;
  return fallback;
}

export function driverDeleteSuccessSummary(
  name: string,
  b: MasterDeleteBlockers,
  ownerPurged: boolean,
  hadLogin: boolean
): string {
  const lines = [`Supir "${name}" dihapus dari Master Driver.`];

  if (ownerPurged) {
    const cleaned: string[] = [];
    if (b.fieldSubmissions)
      cleaned.push(`${b.fieldSubmissions} upload/antrian dokumen (belum/sudah verifikasi)`);
    if (b.operationalCosts)
      cleaned.push(`${b.operationalCosts} catatan biaya operasional terkait supir`);
    if (cleaned.length) {
      lines.push(`Ikut dibersihkan: ${cleaned.join(" · ")}.`);
    }
    lines.push(
      "Tidak ada DO yang terhapus (belum ada trip terverifikasi atas supir ini)."
    );
  } else {
    lines.push("Tidak ada data operasional menggantung yang perlu dibersihkan.");
  }

  if (hadLogin) {
    lines.push(
      "Akun login supir dinonaktifkan (tidak bisa login). Riwayat audit sistem tetap tersimpan."
    );
  }

  lines.push("Penugasan unit default supir dilepas (mobil tidak otomatis ke driver lain).");

  return lines.join("\n\n");
}

export function unitDeleteSuccessSummary(
  unitNumber: string,
  b: MasterDeleteBlockers,
  ownerPurged: boolean
): string {
  const lines = [`Unit "${unitNumber}" dihapus dari Master Unit.`];

  if (ownerPurged) {
    const cleaned: string[] = [];
    if (b.fieldSubmissions)
      cleaned.push(`${b.fieldSubmissions} upload/antrian dokumen unit ini`);
    if (b.operationalCosts)
      cleaned.push(`${b.operationalCosts} catatan biaya operasional terkait unit`);
    if (b.breakdowns) cleaned.push(`${b.breakdowns} riwayat breakdown unit`);
    if (cleaned.length) {
      lines.push(`Ikut dibersihkan: ${cleaned.join(" · ")}.`);
    }
    lines.push("Tidak ada DO yang terhapus.");
    lines.push(
      "Entri jurnal kas yang memakai unit ini tidak dihapus — hanya referensi unit-nya dikosongkan."
    );
  }

  return lines.join("\n\n");
}
