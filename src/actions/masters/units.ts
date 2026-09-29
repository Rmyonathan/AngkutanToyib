"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, UnitStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setUnitDriver } from "@/lib/masters/assign-unit";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { emptyToNull, type ActionResult } from "@/lib/actions/types";

const unitSchema = z.object({
  unitNumber: z.string().min(1, "Nomor unit wajib"),
  brandType: z.string().min(1, "Merk/type wajib"),
  year: z.coerce.number().int().min(1990).max(2100),
  licensePlate: z.string().min(1, "Nomor polisi wajib"),
  capacity: z.coerce.number().positive("Kapasitas harus > 0"),
  defaultDriverId: z.string().optional().nullable(),
  status: z.nativeEnum(UnitStatus),
  currentKm: z.coerce.number().min(0).default(0),
  operationStartDate: z.string().optional().nullable(),
});

export type UnitInput = z.infer<typeof unitSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertMasterWrite() {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "masters:write") &&
    !hasPermission(session.user.role, "*")
  ) {
    throw new Error("Forbidden: ADMIN/OWNER only");
  }
  return session;
}

function mapUnitData(data: UnitInput) {
  return {
    unitNumber: data.unitNumber.trim(),
    brandType: data.brandType.trim(),
    year: data.year,
    licensePlate: data.licensePlate.trim(),
    capacity: data.capacity,
    status: data.status,
    currentKm: data.currentKm,
    operationStartDate: data.operationStartDate
      ? new Date(data.operationStartDate)
      : null,
  };
}

export async function createUnit(
  raw: UnitInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = unitSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }

    const row = await prisma.$transaction(async (tx) => {
      const base = await tx.masterUnit.create({ data: mapUnitData(parsed.data) });
      await setUnitDriver(tx, base.id, emptyToNull(parsed.data.defaultDriverId ?? null));
      const created = await tx.masterUnit.findUniqueOrThrow({ where: { id: base.id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "MasterUnit",
          recordId: created.id,
          oldData: Prisma.JsonNull,
          newData: toJson(created),
        },
      });
      return created;
    });

    revalidatePath("/masters/units");
    revalidatePath("/dashboard");
    return { success: true, data: { id: row.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan unit",
    };
  }
}

export async function updateUnit(
  id: string,
  raw: UnitInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = unitSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }

    const existing = await prisma.masterUnit.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Unit tidak ditemukan" };

    const row = await prisma.$transaction(async (tx) => {
      await tx.masterUnit.update({
        where: { id },
        data: mapUnitData(parsed.data),
      });
      await setUnitDriver(tx, id, emptyToNull(parsed.data.defaultDriverId ?? null));
      const updated = await tx.masterUnit.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "MasterUnit",
          recordId: id,
          oldData: toJson(existing),
          newData: toJson(updated),
        },
      });
      return updated;
    });

    revalidatePath("/masters/units");
    revalidatePath("/masters/drivers");
    revalidatePath("/dashboard");
    return { success: true, data: { id: row.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal update unit",
    };
  }
}

/** Tombol "Assign driver" di tabel unit. driverId null = lepas driver. */
export async function assignUnitDriver(
  unitId: string,
  driverId: string | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const existing = await prisma.masterUnit.findUnique({ where: { id: unitId } });
    if (!existing) return { success: false, error: "Unit tidak ditemukan" };
    if (driverId) {
      const driver = await prisma.masterDriver.findUnique({ where: { id: driverId } });
      if (!driver) return { success: false, error: "Driver tidak ditemukan" };
    }
    if ((existing.defaultDriverId ?? null) === (driverId || null)) {
      return { success: true, data: { id: unitId } };
    }

    await prisma.$transaction(async (tx) => {
      const previousUnit = driverId
        ? await tx.masterUnit.findFirst({
            where: { defaultDriverId: driverId, NOT: { id: unitId } },
            select: { id: true, unitNumber: true },
          })
        : null;
      await setUnitDriver(tx, unitId, driverId || null);
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "MasterUnit",
          recordId: unitId,
          oldData: toJson({ unitNumber: existing.unitNumber, defaultDriverId: existing.defaultDriverId }),
          newData: toJson({ unitNumber: existing.unitNumber, defaultDriverId: driverId || null }),
        },
      });
      if (previousUnit) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: AuditAction.UPDATE,
            tableName: "MasterUnit",
            recordId: previousUnit.id,
            oldData: toJson({ unitNumber: previousUnit.unitNumber, defaultDriverId: driverId }),
            newData: toJson({ unitNumber: previousUnit.unitNumber, defaultDriverId: null }),
          },
        });
      }
    });

    revalidatePath("/masters/units");
    revalidatePath("/masters/drivers");
    revalidatePath("/upload");
    return { success: true, data: { id: unitId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal assign driver",
    };
  }
}

export async function deleteUnit(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const existing = await prisma.masterUnit.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Unit tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.masterUnit.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "MasterUnit",
          recordId: id,
          oldData: toJson(existing),
          newData: Prisma.JsonNull,
        },
      });
    });

    revalidatePath("/masters/units");
    revalidatePath("/dashboard");
    return { success: true, data: { id } };
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Foreign key")
        ? "Unit masih punya data operasi/breakdown — tidak bisa dihapus"
        : err instanceof Error
          ? err.message
          : "Gagal hapus unit";
    return { success: false, error: message };
  }
}
