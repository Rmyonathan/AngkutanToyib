"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { optionalNumber, type ActionResult } from "@/lib/actions/types";

const optNum = z.preprocess(optionalNumber, z.number().min(0).nullable());

const tripSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Nama trip wajib"),
  distanceKm: optNum,
  ratePerTon: optNum,
  uangJalan: optNum,
  isActive: z.boolean().default(true),
});

const customerSchema = z
  .object({
    customerName: z.string().min(1, "Nama customer wajib"),
    loadingLocation: z.string().min(1, "Lokasi loading wajib"),
    dumpingLocation: z.string().min(1, "Lokasi dumping wajib"),
    oneWayDistance: z.coerce.number().min(0),
    ratePerTon: z.coerce.number().positive("Tarif/ton harus > 0"),
    targetTonase: z.coerce.number().min(0).default(0),
    paymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
    isActive: z.coerce.boolean().default(true),
    trips: z.array(tripSchema).min(1, "Minimal 1 trip (rute yang dipilih supir)"),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const t of v.trips) {
      const key = t.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: `Nama trip "${t.name}" dobel` });
        return;
      }
      seen.add(key);
    }
  });

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerTripInput = z.input<typeof tripSchema>;

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

function customerData(d: z.infer<typeof customerSchema>) {
  return {
    customerName: d.customerName.trim(),
    loadingLocation: d.loadingLocation.trim(),
    dumpingLocation: d.dumpingLocation.trim(),
    oneWayDistance: d.oneWayDistance,
    ratePerTon: d.ratePerTon,
    targetTonase: d.targetTonase,
    paymentTermDays: d.paymentTermDays,
    isActive: d.isActive,
  };
}

function tripData(t: z.infer<typeof tripSchema>) {
  return {
    name: t.name,
    distanceKm: t.distanceKm,
    ratePerTon: t.ratePerTon || null,
    uangJalan: t.uangJalan,
    isActive: t.isActive,
  };
}

/**
 * Sinkron daftar trip customer. Trip yang dihapus dari form tapi sudah punya
 * upload / DO cukup dinonaktifkan supaya riwayat tetap utuh.
 */
async function syncTrips(
  tx: Prisma.TransactionClient,
  customerId: string,
  trips: z.infer<typeof tripSchema>[],
  userId: string
) {
  const existing = await tx.customerTrip.findMany({
    where: { customerId },
    include: { _count: { select: { deliveryOrders: true, fieldSubmissions: true } } },
  });
  const keepIds = new Set(trips.map((t) => t.id).filter(Boolean));
  const logs: Prisma.AuditLogCreateManyInput[] = [];

  for (const old of existing) {
    if (keepIds.has(old.id)) continue;
    const { _count, ...row } = old;
    if (_count.deliveryOrders > 0 || _count.fieldSubmissions > 0) {
      if (!old.isActive) continue;
      const updated = await tx.customerTrip.update({
        where: { id: old.id },
        data: { isActive: false },
      });
      logs.push({
        userId,
        action: AuditAction.UPDATE,
        tableName: "CustomerTrip",
        recordId: old.id,
        oldData: toJson(row),
        newData: toJson(updated),
      });
    } else {
      await tx.customerTrip.delete({ where: { id: old.id } });
      logs.push({
        userId,
        action: AuditAction.DELETE,
        tableName: "CustomerTrip",
        recordId: old.id,
        oldData: toJson(row),
        newData: Prisma.JsonNull,
      });
    }
  }

  // Rename bebas bentrok unique(customerId, name): kosongkan nama lama dulu
  for (const t of trips) {
    const old = t.id ? existing.find((e) => e.id === t.id) : undefined;
    if (old && old.name !== t.name) {
      await tx.customerTrip.update({
        where: { id: old.id },
        data: { name: `__rename_${old.id}` },
      });
    }
  }

  for (const t of trips) {
    const old = t.id ? existing.find((e) => e.id === t.id) : undefined;
    if (old) {
      const updated = await tx.customerTrip.update({
        where: { id: old.id },
        data: tripData(t),
      });
      const { _count, ...row } = old;
      void _count;
      if (JSON.stringify(tripData(t)) !== JSON.stringify(tripData({ ...row, id: row.id }))) {
        logs.push({
          userId,
          action: AuditAction.UPDATE,
          tableName: "CustomerTrip",
          recordId: old.id,
          oldData: toJson(row),
          newData: toJson(updated),
        });
      }
    } else {
      const created = await tx.customerTrip.create({
        data: { customerId, ...tripData(t) },
      });
      logs.push({
        userId,
        action: AuditAction.CREATE,
        tableName: "CustomerTrip",
        recordId: created.id,
        oldData: Prisma.JsonNull,
        newData: toJson(created),
      });
    }
  }

  if (logs.length) await tx.auditLog.createMany({ data: logs });
}

function revalidateCustomerPaths() {
  revalidatePath("/masters/customers");
  revalidatePath("/upload");
  revalidatePath("/operations/verify");
  revalidatePath("/operations/trips");
}

export async function createCustomer(
  raw: CustomerInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = customerSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.masterCustomer.create({
        data: customerData(parsed.data),
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "MasterCustomer",
          recordId: created.id,
          oldData: Prisma.JsonNull,
          newData: toJson(created),
        },
      });
      await syncTrips(tx, created.id, parsed.data.trips, session.user.id);
      return created;
    });

    revalidateCustomerPaths();
    return { success: true, data: { id: row.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan customer",
    };
  }
}

export async function updateCustomer(
  id: string,
  raw: CustomerInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const parsed = customerSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }

    const existing = await prisma.masterCustomer.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Customer tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      const updated = await tx.masterCustomer.update({
        where: { id },
        data: customerData(parsed.data),
      });
      if (JSON.stringify(customerData(parsed.data)) !== JSON.stringify(customerData({ ...existing, trips: [] }))) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: AuditAction.UPDATE,
            tableName: "MasterCustomer",
            recordId: id,
            oldData: toJson(existing),
            newData: toJson(updated),
          },
        });
      }
      await syncTrips(tx, id, parsed.data.trips, session.user.id);
    });

    revalidateCustomerPaths();
    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal update customer",
    };
  }
}

export async function deleteCustomer(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertMasterWrite();
    const existing = await prisma.masterCustomer.findUnique({
      where: { id },
      include: { _count: { select: { deliveryOrders: true, invoices: true } } },
    });
    if (!existing) return { success: false, error: "Customer tidak ditemukan" };
    const { _count, ...row } = existing;
    if (_count.deliveryOrders > 0 || _count.invoices > 0) {
      return {
        success: false,
        error: "Customer sudah punya DO / invoice — nonaktifkan saja, jangan dihapus",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterCustomer.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "MasterCustomer",
          recordId: id,
          oldData: toJson(row),
          newData: Prisma.JsonNull,
        },
      });
    });

    revalidateCustomerPaths();
    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error && err.message.includes("Foreign key")
          ? "Customer masih punya upload supir — nonaktifkan saja"
          : err instanceof Error
            ? err.message
            : "Gagal hapus customer",
    };
  }
}
