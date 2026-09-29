"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  JournalCategory,
  JournalEntryType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canWriteHpp } from "@/lib/auth/rbac";
import { tryParseDateOnly } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

const journalSchema = z.object({
  date: z.string().min(1),
  entryType: z.nativeEnum(JournalEntryType),
  category: z.nativeEnum(JournalCategory),
  description: z.string().min(1, "Keterangan wajib"),
  amount: z.coerce.number().positive("Nominal harus > 0"),
  unitId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type JournalInput = z.infer<typeof journalSchema>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertJournalWrite() {
  const session = await requireSession();
  if (!canWriteHpp(session.user.role)) {
    throw new Error("Forbidden: butuh hak akses Ubah HPP & Jurnal Kas");
  }
  return session;
}

export async function createHppJournalEntry(
  raw: JournalInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertJournalWrite();
    const parsed = journalSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid",
      };
    }

    const d = parsed.data;
    const date = tryParseDateOnly(d.date);
    if (!date) return { success: false, error: "Tanggal tidak valid" };

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.hppJournalEntry.create({
        data: {
          date,
          entryType: d.entryType,
          category: d.category,
          description: d.description.trim(),
          amount: d.amount,
          unitId: d.unitId || null,
          notes: d.notes?.trim() || null,
          createdById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "HppJournalEntry",
          recordId: created.id,
          newData: toJson(created),
        },
      });
      return created;
    });

    revalidatePath("/finance");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    revalidatePath("/finance/kas");
    revalidatePath("/masters/costs");
    return { success: true, data: { id: row.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal simpan jurnal",
    };
  }
}

export async function deleteHppJournalEntry(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertJournalWrite();
    const existing = await prisma.hppJournalEntry.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Entri tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.hppJournalEntry.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "HppJournalEntry",
          recordId: id,
          oldData: toJson(existing),
        },
      });
    });

    revalidatePath("/finance");
    revalidatePath("/finance/buku-harian");
    revalidatePath("/finance/profitabilitas");
    revalidatePath("/finance/kas");
    revalidatePath("/masters/costs");
    return { success: true, data: { id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Gagal hapus jurnal",
    };
  }
}
