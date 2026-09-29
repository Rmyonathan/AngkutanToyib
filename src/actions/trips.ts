"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, OperationalCostType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canManageTrips } from "@/lib/auth/rbac";
import { tryParseDateOnly } from "@/lib/dates";
import { recalcInvoice } from "@/lib/finance/invoice-recalc";
import { optionalNumber, type ActionResult } from "@/lib/actions/types";

const optNum = z.preprocess(optionalNumber, z.number().min(0).nullable());

const updateTripSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  unitId: z.string().min(1),
  driverId: z.string().min(1),
  customerTripId: z.string().min(1, "Pilih trip"),
  uangJalan: z.coerce.number().min(0).default(0),
  ratePerTon: z.coerce.number().min(0).default(0),
  ticketNumber: z.string().trim().min(1, "Nomor tiket wajib"),
  netto: z.coerce.number().positive("Tonase harus > 0"),
  kmHauling: optNum,
  solarLiters: optNum,
  solarPricePerLiter: optNum,
  otherAmount: optNum,
  otherDescription: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateTripInput = z.input<typeof updateTripSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function revalidateTripPaths(id: string, invoiceId: string | null) {
  revalidatePath("/operations/trips");
  revalidatePath(`/operations/trips/${id}`);
  revalidatePath("/operations/solar");
  revalidatePath("/finance/buku-harian");
  revalidatePath("/finance/kas");
  revalidatePath("/finance/profitabilitas");
  revalidatePath("/finance/piutang");
  if (invoiceId) revalidatePath(`/finance/piutang/${invoiceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

/**
 * Edit DO kapan pun (juga setelah ditagih / lunas) untuk koreksi salah verifikasi.
 * DO yang sudah masuk invoice: total invoice dihitung ulang, customer tidak boleh diganti.
 */
export async function updateDoTrip(
  raw: UpdateTripInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    if (!canManageTrips(session.user.role)) {
      return { success: false, error: "Forbidden: ADMIN/OWNER only" };
    }

    const parsed = updateTripSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }
    const data = parsed.data;

    const existing = await prisma.deliveryOrder.findUnique({
      where: { id: data.id },
      include: {
        invoice: { select: { invoiceNumber: true } },
        fieldSubmission: { select: { id: true } },
        operationalCosts: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!existing) return { success: false, error: "DO tidak ditemukan" };

    const date = tryParseDateOnly(data.date);
    if (!date) return { success: false, error: "Tanggal tidak valid" };

    const [unit, driver, trip] = await Promise.all([
      prisma.masterUnit.findUnique({ where: { id: data.unitId } }),
      prisma.masterDriver.findUnique({ where: { id: data.driverId } }),
      prisma.customerTrip.findUnique({
        where: { id: data.customerTripId },
        include: { customer: true },
      }),
    ]);
    if (!unit) return { success: false, error: "Unit tidak ditemukan" };
    if (!driver) return { success: false, error: "Driver tidak ditemukan" };
    if (!trip) return { success: false, error: "Trip tidak ditemukan" };

    if (existing.invoiceId && trip.customerId !== existing.customerId) {
      return {
        success: false,
        error: `DO sudah masuk invoice ${existing.invoice?.invoiceNumber ?? ""} — pilih trip dari customer yang sama, atau batalkan invoice dulu`,
      };
    }

    const ticket = data.ticketNumber;
    if (ticket !== existing.ticketNumber) {
      const dup = await prisma.deliveryOrder.findFirst({
        where: { ticketNumber: ticket, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (dup) {
        return { success: false, error: `Nomor tiket "${ticket}" sudah dipakai` };
      }
    }

    const liters = data.solarLiters ?? 0;
    const pricePerLiter = data.solarPricePerLiter ?? 0;
    if ((liters > 0 || pricePerLiter > 0) && (liters <= 0 || pricePerLiter <= 0)) {
      return {
        success: false,
        error: "Solar: isi liter dan harga / liter (atau kosongkan keduanya)",
      };
    }
    const otherAmount = data.otherAmount ?? 0;

    const ratePerTon =
      data.ratePerTon || trip.ratePerTon || trip.customer.ratePerTon;

    await prisma.$transaction(async (tx) => {
      const { fieldSubmission, operationalCosts: costs } = existing;
      const before = {
        ...existing,
        invoice: undefined,
        fieldSubmission: undefined,
        operationalCosts: undefined,
      };
      const updated = await tx.deliveryOrder.update({
        where: { id: existing.id },
        data: {
          date,
          unitId: data.unitId,
          driverId: data.driverId,
          customerTripId: trip.id,
          customerId: trip.customerId,
          uangJalan: data.uangJalan,
          ratePerTon,
          ticketNumber: ticket,
          netto: Math.round(data.netto * 1000) / 1000,
          kmHauling: data.kmHauling ?? null,
          notes: data.notes?.trim() || null,
        },
      });
      await tx.operationalCost.updateMany({
        where: { deliveryOrderId: existing.id },
        data: { date, unitId: data.unitId, driverId: data.driverId },
      });

      const audits: Prisma.AuditLogCreateManyInput[] = [
        {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "DeliveryOrder",
          recordId: updated.id,
          oldData: toJson(before),
          newData: toJson(updated),
        },
      ];

      const syncCost = async (
        current: (typeof costs)[number] | undefined,
        next: Omit<Prisma.OperationalCostUncheckedCreateInput, "date" | "unitId" | "driverId" | "deliveryOrderId"> | null
      ) => {
        if (!next) {
          if (!current) return;
          await tx.operationalCost.delete({ where: { id: current.id } });
          audits.push({
            userId: session.user.id,
            action: AuditAction.DELETE,
            tableName: "OperationalCost",
            recordId: current.id,
            oldData: toJson(current),
          });
          return;
        }
        if (current) {
          const row = await tx.operationalCost.update({
            where: { id: current.id },
            data: next,
          });
          if (
            row.amount !== current.amount ||
            row.volume !== current.volume ||
            row.pricePerLiter !== current.pricePerLiter ||
            row.description !== current.description
          ) {
            audits.push({
              userId: session.user.id,
              action: AuditAction.UPDATE,
              tableName: "OperationalCost",
              recordId: row.id,
              oldData: toJson(current),
              newData: toJson(row),
            });
          }
          return;
        }
        const row = await tx.operationalCost.create({
          data: {
            ...next,
            date,
            unitId: data.unitId,
            driverId: data.driverId,
            deliveryOrderId: existing.id,
            fieldSubmissionId: fieldSubmission?.id ?? null,
          },
        });
        audits.push({
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "OperationalCost",
          recordId: row.id,
          newData: toJson(row),
        });
      };

      await syncCost(
        costs.find((c) => c.costType === OperationalCostType.SOLAR),
        liters > 0
          ? {
              costType: OperationalCostType.SOLAR,
              volume: liters,
              pricePerLiter,
              amount: Math.round(liters * pricePerLiter),
              description: "Nota Solar",
            }
          : null
      );
      await syncCost(
        costs.find((c) => c.costType !== OperationalCostType.SOLAR),
        otherAmount > 0
          ? {
              costType: OperationalCostType.LAINNYA,
              amount: otherAmount,
              description: data.otherDescription?.trim() || "Biaya Lain",
            }
          : null
      );

      if (existing.invoiceId) await recalcInvoice(tx, existing.invoiceId);
      await tx.auditLog.createMany({ data: audits });
    });

    revalidateTripPaths(existing.id, existing.invoiceId);
    return { success: true, data: { id: existing.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal update DO",
    };
  }
}
