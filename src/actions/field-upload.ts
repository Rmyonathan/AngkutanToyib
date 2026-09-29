"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, FieldSubmissionStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canSubmitFieldDocs, canVerifyFieldDocs } from "@/lib/auth/rbac";
import { todayDateOnly, tryParseDateOnly } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

const uploadSchema = z.object({
  customerTripId: z.string().min(1, "Pilih trip"),
  suratJalanPhoto: z.string().min(1, "Foto Surat Jalan wajib"),
  solarPhoto: z.string().optional().nullable(),
  otherPhoto: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  /** Hanya dipakai Admin yang upload atas nama supir */
  driverId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});

export type FieldUploadInput = z.infer<typeof uploadSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Supir: driver & unit otomatis dari akun login (Master Driver ↔ User,
 * Master Unit ↔ Driver), tanggal = hari ini.
 * Admin (ops:verify) tanpa akun driver: boleh upload atas nama supir.
 */
export async function createFieldUpload(
  raw: FieldUploadInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    if (!canSubmitFieldDocs(session.user.role)) {
      return { success: false, error: "Forbidden: tidak punya akses upload" };
    }

    const parsed = uploadSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }
    const data = parsed.data;

    const ownDriver = await prisma.masterDriver.findUnique({
      where: { userId: session.user.id },
      include: { assignedUnit: { select: { id: true } } },
    });

    let driverId: string;
    let unitId: string | null;
    let date: Date | null;

    if (ownDriver) {
      driverId = ownDriver.id;
      unitId = ownDriver.assignedUnit?.id ?? null;
      date = tryParseDateOnly(todayDateOnly());
      if (!unitId) {
        return {
          success: false,
          error: "Akun Anda belum di-assign ke unit. Hubungi admin.",
        };
      }
    } else if (canVerifyFieldDocs(session.user.role)) {
      if (!data.driverId) return { success: false, error: "Pilih driver" };
      const driver = await prisma.masterDriver.findUnique({
        where: { id: data.driverId },
        include: { assignedUnit: { select: { id: true } } },
      });
      if (!driver) return { success: false, error: "Driver tidak ditemukan" };
      driverId = driver.id;
      unitId = data.unitId || driver.assignedUnit?.id || null;
      date = tryParseDateOnly(data.date || todayDateOnly());
      if (!unitId) return { success: false, error: "Pilih unit" };
    } else {
      return {
        success: false,
        error: "Akun Anda belum terhubung ke data driver. Hubungi admin.",
      };
    }
    if (!date) return { success: false, error: "Tanggal tidak valid" };

    const trip = await prisma.customerTrip.findUnique({
      where: { id: data.customerTripId },
      include: { customer: { select: { isActive: true } } },
    });
    if (!trip || !trip.isActive || !trip.customer.isActive) {
      return { success: false, error: "Trip tidak aktif / tidak ditemukan" };
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.fieldSubmission.create({
        data: {
          date,
          unitId,
          driverId,
          customerTripId: trip.id,
          suratJalanPhoto: data.suratJalanPhoto,
          solarPhoto: data.solarPhoto || null,
          otherPhoto: data.otherPhoto || null,
          notes: data.notes?.trim() || null,
          status: FieldSubmissionStatus.PENDING,
          createdById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "FieldSubmission",
          recordId: row.id,
          newData: toJson(row),
        },
      });
      return row;
    });

    revalidatePath("/upload");
    revalidatePath("/operations/verify");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal upload",
    };
  }
}
