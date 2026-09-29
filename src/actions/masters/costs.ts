"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canWriteHpp } from "@/lib/auth/rbac";
import type { ActionResult } from "@/lib/actions/types";

const costSchema = z.object({
  name: z.string().min(1).default("Default"),
  isActive: z.coerce.boolean().default(true),
  globalSolarPrice: z.coerce.number().min(0),
  globalTirePrice: z.coerce.number().min(0),
  tireLifespanDays: z.coerce.number().int().positive(),
  defaultMaintenanceBudget: z.coerce.number().min(0),
  defaultCicilan: z.coerce.number().min(0),
  defaultDepreciation: z.coerce.number().min(0),
  defaultMovingCost: z.coerce.number().min(0),
  estimatedOpsDaysPerMonth: z.coerce.number().int().positive().default(25),
});

export type CostConfigInput = z.infer<typeof costSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertCostWrite() {
  const session = await requireSession();
  if (!canWriteHpp(session.user.role)) {
    throw new Error("Forbidden: butuh hak akses Ubah HPP & Jurnal Kas");
  }
  return session;
}

export async function upsertActiveCostConfig(
  raw: CostConfigInput,
  id?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertCostWrite();
    const parsed = costSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }

    const data = {
      name: parsed.data.name.trim(),
      isActive: parsed.data.isActive,
      globalSolarPrice: parsed.data.globalSolarPrice,
      globalTirePrice: parsed.data.globalTirePrice,
      tireLifespanDays: parsed.data.tireLifespanDays,
      defaultMaintenanceBudget: parsed.data.defaultMaintenanceBudget,
      defaultCicilan: parsed.data.defaultCicilan,
      defaultDepreciation: parsed.data.defaultDepreciation,
      defaultMovingCost: parsed.data.defaultMovingCost,
      estimatedOpsDaysPerMonth: parsed.data.estimatedOpsDaysPerMonth,
    };

    const row = await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.masterCostConfig.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      if (id) {
        const existing = await tx.masterCostConfig.findUnique({ where: { id } });
        if (!existing) throw new Error("Config tidak ditemukan");
        const updated = await tx.masterCostConfig.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: AuditAction.UPDATE,
            tableName: "MasterCostConfig",
            recordId: id,
            oldData: toJson(existing),
            newData: toJson(updated),
          },
        });
        return updated;
      }

      const created = await tx.masterCostConfig.create({ data });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "MasterCostConfig",
          recordId: created.id,
          oldData: Prisma.JsonNull,
          newData: toJson(created),
        },
      });
      return created;
    });

    revalidatePath("/masters/costs");
    revalidatePath("/settings/hpp");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    revalidatePath("/finance/kas");
    revalidatePath("/dashboard");
    return { success: true, data: { id: row.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal simpan biaya",
    };
  }
}
