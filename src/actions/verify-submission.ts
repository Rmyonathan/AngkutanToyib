"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  DeliveryOrderStatus,
  FieldSubmissionStatus,
  OperationalCostType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canVerifyFieldDocs } from "@/lib/auth/rbac";
import { tryParseDateOnly } from "@/lib/dates";
import { nextInternalTripId } from "@/lib/operations/trip-id";
import { optionalNumber, type ActionResult } from "@/lib/actions/types";

const optNum = z.preprocess(optionalNumber, z.number().min(0).nullable());

const verifySchema = z.object({
  fieldSubmissionId: z.string().min(1),
  date: z.string().min(1),
  customerTripId: z.string().min(1, "Pilih trip"),
  ticketNumber: z.string().trim().min(1, "Nomor tiket wajib"),
  netto: z.coerce.number().positive("Tonase harus > 0"),
  kmHauling: optNum,
  ratePerTon: z.coerce.number().positive("Tarif/ton harus > 0"),
  uangJalan: z.coerce.number().min(0).default(0),
  solarLiters: optNum,
  solarPricePerLiter: optNum,
  otherAmount: optNum,
  otherDescription: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VerifySubmissionInput = z.input<typeof verifySchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function revalidateAll() {
  revalidatePath("/operations/verify");
  revalidatePath("/operations/trips");
  revalidatePath("/operations/solar");
  revalidatePath("/upload");
  revalidatePath("/finance/buku-harian");
  revalidatePath("/finance/kas");
  revalidatePath("/finance/profitabilitas");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

/**
 * Admin cek foto upload supir lalu input data dokumen → DO dibuat (VERIFIED),
 * plus biaya Solar (liter × harga/liter) dan Biaya Lain bila ada.
 */
export async function verifySubmission(
  raw: VerifySubmissionInput
): Promise<ActionResult<{ id: string; internalTripId: string }>> {
  try {
    const session = await requireSession();
    if (!canVerifyFieldDocs(session.user.role)) {
      return { success: false, error: "Forbidden" };
    }

    const parsed = verifySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }
    const data = parsed.data;

    const date = tryParseDateOnly(data.date);
    if (!date) return { success: false, error: "Tanggal tidak valid" };

    const sub = await prisma.fieldSubmission.findUnique({
      where: { id: data.fieldSubmissionId },
    });
    if (!sub) return { success: false, error: "Upload tidak ditemukan" };
    if (sub.status !== FieldSubmissionStatus.PENDING) {
      return { success: false, error: "Upload ini sudah diproses" };
    }

    const trip = await prisma.customerTrip.findUnique({
      where: { id: data.customerTripId },
    });
    if (!trip) return { success: false, error: "Trip tidak ditemukan" };

    const dup = await prisma.deliveryOrder.findFirst({
      where: { ticketNumber: data.ticketNumber },
      select: { internalTripId: true },
    });
    if (dup) {
      return {
        success: false,
        error: `Nomor tiket "${data.ticketNumber}" sudah dipakai di ${dup.internalTripId}`,
      };
    }

    const liters = data.solarLiters ?? 0;
    const pricePerLiter = data.solarPricePerLiter ?? 0;
    const hasSolar = liters > 0 || pricePerLiter > 0;
    if (hasSolar && (liters <= 0 || pricePerLiter <= 0)) {
      return {
        success: false,
        error: "Solar: isi liter dan harga / liter (atau kosongkan keduanya)",
      };
    }
    const otherAmount = data.otherAmount ?? 0;

    const created = await prisma.$transaction(async (tx) => {
      const internalTripId = await nextInternalTripId(tx, date);
      const doRow = await tx.deliveryOrder.create({
        data: {
          internalTripId,
          date,
          unitId: sub.unitId,
          driverId: sub.driverId,
          customerId: trip.customerId,
          customerTripId: trip.id,
          uangJalan: data.uangJalan,
          ratePerTon: data.ratePerTon,
          ticketNumber: data.ticketNumber,
          netto: Math.round(data.netto * 1000) / 1000,
          kmHauling: data.kmHauling ?? null,
          suratJalanPhoto: sub.suratJalanPhoto,
          status: DeliveryOrderStatus.VERIFIED,
          notes: data.notes?.trim() || sub.notes || null,
          createdById: session.user.id,
        },
      });

      const costs = [];
      if (hasSolar) {
        costs.push(
          await tx.operationalCost.create({
            data: {
              costType: OperationalCostType.SOLAR,
              date,
              unitId: sub.unitId,
              driverId: sub.driverId,
              deliveryOrderId: doRow.id,
              volume: liters,
              pricePerLiter,
              amount: Math.round(liters * pricePerLiter),
              description: "Nota Solar",
              fieldSubmissionId: sub.id,
            },
          })
        );
      }
      if (otherAmount > 0) {
        costs.push(
          await tx.operationalCost.create({
            data: {
              costType: OperationalCostType.LAINNYA,
              date,
              unitId: sub.unitId,
              driverId: sub.driverId,
              deliveryOrderId: doRow.id,
              amount: otherAmount,
              description: data.otherDescription?.trim() || "Biaya Lain",
              fieldSubmissionId: sub.id,
            },
          })
        );
      }

      await tx.fieldSubmission.update({
        where: { id: sub.id },
        data: {
          status: FieldSubmissionStatus.PROCESSED,
          deliveryOrderId: doRow.id,
        },
      });

      await tx.auditLog.createMany({
        data: [
          {
            userId: session.user.id,
            action: AuditAction.CREATE,
            tableName: "DeliveryOrder",
            recordId: doRow.id,
            newData: toJson(doRow),
          },
          ...costs.map((c) => ({
            userId: session.user.id,
            action: AuditAction.CREATE,
            tableName: "OperationalCost",
            recordId: c.id,
            newData: toJson(c),
          })),
        ],
      });

      return doRow;
    });

    revalidateAll();
    return {
      success: true,
      data: { id: created.id, internalTripId: created.internalTripId },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal verifikasi",
    };
  }
}

export async function rejectFieldSubmission(
  id: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    if (!canVerifyFieldDocs(session.user.role)) {
      return { success: false, error: "Forbidden" };
    }

    const existing = await prisma.fieldSubmission.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Tidak ditemukan" };
    if (existing.status !== FieldSubmissionStatus.PENDING) {
      return { success: false, error: "Sudah diproses" };
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.fieldSubmission.update({
        where: { id },
        data: {
          status: FieldSubmissionStatus.REJECTED,
          rejectReason: reason?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "FieldSubmission",
          recordId: id,
          oldData: toJson(existing),
          newData: toJson(updated),
        },
      });
    });

    revalidateAll();
    return { success: true, data: { id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal reject",
    };
  }
}
