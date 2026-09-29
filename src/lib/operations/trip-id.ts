import type { Prisma } from "@prisma/client";

/** TRIP-YYYYMMDD-0001, urut per tanggal DO */
export async function nextInternalTripId(
  tx: Prisma.TransactionClient,
  date: Date
) {
  const prefix = `TRIP-${date.toISOString().slice(0, 10).replace(/-/g, "")}-`;
  const last = await tx.deliveryOrder.findFirst({
    where: { internalTripId: { startsWith: prefix } },
    orderBy: { internalTripId: "desc" },
    select: { internalTripId: true },
  });
  const seq = last ? Number(last.internalTripId.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}
