"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { parseDateOnly, parseWibDateTime } from "@/lib/dates";
import { syncUnitBreakdownStatus } from "@/lib/breakdown/unit-status";
import type { ActionResult } from "@/lib/actions/types";

const breakdownSchema = z.object({
  unitId: z.string().min(1, "Unit wajib"),
  date: z.string().min(1, "Tanggal wajib"),
  issueDescription: z.string().min(1, "Masalah wajib"),
  startTime: z.string().min(1, "Waktu mulai wajib"),
  endTime: z.string().optional().nullable(),
  downtimeHours: z.union([z.coerce.number(), z.literal("")]).optional().nullable(),
  maintenanceCost: z.coerce.number().min(0).default(0),
});

export type BreakdownInput = z.infer<typeof breakdownSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertBreakdownWrite() {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "breakdown:write") &&
    !hasPermission(session.user.role, "*")
  ) {
    throw new Error("Forbidden: ADMIN/OWNER only");
  }
  return session;
}

const parseDateTime = parseWibDateTime;

function calcDowntimeHours(
  start: Date,
  end: Date | null,
  manual: number | null | undefined
): number | null {
  if (manual != null && Number.isFinite(manual) && manual >= 0) return manual;
  if (!end) return null;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.round(hours * 100) / 100);
}

async function syncUnitStatus(tx: Prisma.TransactionClient, unitId: string) {
  await syncUnitBreakdownStatus(tx, [unitId]);
}

function mapData(raw: BreakdownInput) {
  const startTime = parseDateTime(raw.startTime);
  const endTime =
    raw.endTime && String(raw.endTime).trim() !== ""
      ? parseDateTime(String(raw.endTime))
      : null;

  if (endTime && endTime.getTime() < startTime.getTime()) {
    throw new Error("Waktu selesai harus setelah mulai");
  }

  const manual =
    raw.downtimeHours === "" || raw.downtimeHours == null
      ? null
      : Number(raw.downtimeHours);

  return {
    unitId: raw.unitId,
    date: parseDateOnly(raw.date),
    issueDescription: raw.issueDescription.trim(),
    startTime,
    endTime,
    downtimeHours: calcDowntimeHours(startTime, endTime, manual),
    maintenanceCost: raw.maintenanceCost ?? 0,
  };
}

export async function createBreakdown(
  raw: BreakdownInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBreakdownWrite();
    const parsed = breakdownSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }

    let data;
    try {
      data = mapData(parsed.data);
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Data tidak valid",
      };
    }

    const unit = await prisma.masterUnit.findUnique({
      where: { id: data.unitId },
    });
    if (!unit) return { success: false, error: "Unit tidak ditemukan" };

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.breakdownHistory.create({ data });
      await syncUnitStatus(tx, data.unitId);
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "BreakdownHistory",
          recordId: created.id,
          newData: toJson(created),
        },
      });
      return created;
    });

    revalidatePath("/breakdown");
    revalidatePath("/dashboard");
    revalidatePath("/masters/units");
    revalidatePath("/finance/kas");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    return { success: true, data: { id: row.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal simpan breakdown",
    };
  }
}

export async function updateBreakdown(
  id: string,
  raw: BreakdownInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBreakdownWrite();
    const parsed = breakdownSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }

    const existing = await prisma.breakdownHistory.findUnique({
      where: { id },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan" };

    let data;
    try {
      data = mapData(parsed.data);
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Data tidak valid",
      };
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.breakdownHistory.update({
        where: { id },
        data,
      });

      // If unit changed, refresh both old and new
      if (existing.unitId !== data.unitId) {
        await syncUnitStatus(tx, existing.unitId);
      }
      await syncUnitStatus(tx, data.unitId);

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "BreakdownHistory",
          recordId: id,
          oldData: toJson(existing),
          newData: toJson(updated),
        },
      });
    });

    revalidatePath("/breakdown");
    revalidatePath("/dashboard");
    revalidatePath("/masters/units");
    revalidatePath("/finance/kas");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    return { success: true, data: { id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal update breakdown",
    };
  }
}

export async function deleteBreakdown(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBreakdownWrite();
    const existing = await prisma.breakdownHistory.findUnique({
      where: { id },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.breakdownHistory.delete({ where: { id } });
      await syncUnitStatus(tx, existing.unitId);
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "BreakdownHistory",
          recordId: id,
          oldData: toJson(existing),
        },
      });
    });

    revalidatePath("/breakdown");
    revalidatePath("/dashboard");
    revalidatePath("/masters/units");
    revalidatePath("/finance/kas");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    return { success: true, data: { id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal hapus breakdown",
    };
  }
}
