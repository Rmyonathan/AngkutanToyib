import type { Prisma } from "@prisma/client";

/**
 * 1 driver = 1 unit. Pasang driver ke unit (atau lepas bila unitId null);
 * unit lain yang sebelumnya dipegang driver ini otomatis dilepas,
 * dan driver lama unit tujuan otomatis kehilangan unitnya.
 */
export async function setDriverUnit(
  tx: Prisma.TransactionClient,
  driverId: string,
  unitId: string | null
) {
  await tx.masterUnit.updateMany({
    where: {
      defaultDriverId: driverId,
      ...(unitId ? { NOT: { id: unitId } } : {}),
    },
    data: { defaultDriverId: null },
  });
  if (unitId) {
    await tx.masterUnit.update({
      where: { id: unitId },
      data: { defaultDriverId: driverId },
    });
  }
}

/** Sama seperti setDriverUnit, dilihat dari sisi unit (driverId null = kosongkan). */
export async function setUnitDriver(
  tx: Prisma.TransactionClient,
  unitId: string,
  driverId: string | null
) {
  if (driverId) return setDriverUnit(tx, driverId, unitId);
  await tx.masterUnit.update({
    where: { id: unitId },
    data: { defaultDriverId: null },
  });
}
