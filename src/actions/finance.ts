"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  DeliveryOrderStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { canManageBilling } from "@/lib/auth/rbac";
import { DO_INVOICEABLE_STATUSES } from "@/lib/operations/do-status";
import { addDays, formatDateOnly, parseDateOnly, tryParseDateOnly } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";
import { INVOICE_TOLERANCE as TOLERANCE, recalcInvoice } from "@/lib/finance/invoice-recalc";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertBillingWrite() {
  const session = await requireSession();
  if (!canManageBilling(session.user.role)) {
    throw new Error("Forbidden: OWNER / FINANCE / ADMIN only");
  }
  return session;
}

function revalidateBilling(invoiceId?: string) {
  revalidatePath("/finance/piutang");
  if (invoiceId) revalidatePath(`/finance/piutang/${invoiceId}`);
  revalidatePath("/finance/pembayaran");
  revalidatePath("/finance/kas");
  revalidatePath("/finance/buku-harian");
  revalidatePath("/operations/trips");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

function fail(e: unknown, fallback: string) {
  return {
    success: false as const,
    error: e instanceof Error ? e.message : fallback,
  };
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, invoiceDate: Date) {
  const prefix = `INV-${formatDateOnly(invoiceDate).slice(0, 7).replace("-", "")}-`;
  const last = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last ? Number(last.invoiceNumber.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

// ─── Create invoice from selected DOs ────────────────────────────────────────

const createInvoiceSchema = z.object({
  doIds: z.array(z.string().min(1)).min(1, "Pilih minimal 1 DO"),
  invoiceDate: z.string().min(1, "Tanggal invoice wajib"),
  /** Override tempo; default = customer.paymentTermDays */
  termDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export async function createInvoiceFromDos(
  raw: CreateInvoiceInput
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const session = await assertBillingWrite();
    const parsed = createInvoiceSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const data = parsed.data;
    const invoiceDate = tryParseDateOnly(data.invoiceDate);
    if (!invoiceDate) return { success: false, error: "Tanggal invoice tidak valid" };

    const dos = await prisma.deliveryOrder.findMany({
      where: { id: { in: data.doIds } },
      include: { customer: true },
      orderBy: { date: "asc" },
    });
    if (dos.length !== data.doIds.length) {
      return { success: false, error: "Sebagian DO tidak ditemukan" };
    }
    const bad = dos.find(
      (d) => !DO_INVOICEABLE_STATUSES.includes(d.status) || d.invoiceId
    );
    if (bad) {
      return {
        success: false,
        error: `${bad.internalTripId} belum verified atau sudah di-invoice`,
      };
    }
    const noCustomer = dos.find((d) => !d.customerId);
    if (noCustomer) {
      return {
        success: false,
        error: `${noCustomer.internalTripId} belum punya customer — set lewat Edit DO`,
      };
    }
    const customerIds = new Set(dos.map((d) => d.customerId));
    if (customerIds.size > 1) {
      return { success: false, error: "Satu invoice hanya untuk satu customer" };
    }
    const customer = dos[0].customer!;
    const noNetto = dos.find((d) => !d.netto || d.netto <= 0);
    if (noNetto) {
      return { success: false, error: `${noNetto.internalTripId} belum punya tonase` };
    }

    const totalTonase =
      Math.round(dos.reduce((s, d) => s + (d.netto ?? 0), 0) * 1000) / 1000;
    const totalAmount = Math.round(
      dos.reduce((s, d) => s + (d.netto ?? 0) * (d.ratePerTon || customer.ratePerTon), 0)
    );
    const termDays = data.termDays ?? customer.paymentTermDays;
    const dueDate = parseDateOnly(addDays(formatDateOnly(invoiceDate), termDays));

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx, invoiceDate);
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customer.id,
          invoiceDate,
          dueDate,
          periodStart: dos[0].date,
          periodEnd: dos[dos.length - 1].date,
          totalTonase,
          ratePerTon: totalTonase > 0 ? totalAmount / totalTonase : 0,
          totalAmount,
          status: InvoiceStatus.ISSUED,
          notes: data.notes?.trim() || null,
          createdById: session.user.id,
        },
      });
      const moved = await tx.deliveryOrder.updateMany({
        where: {
          id: { in: dos.map((d) => d.id) },
          invoiceId: null,
          status: { in: DO_INVOICEABLE_STATUSES },
        },
        data: { invoiceId: inv.id, status: DeliveryOrderStatus.INVOICED },
      });
      if (moved.count !== dos.length) {
        throw new Error("DO berubah saat membuat invoice — coba lagi");
      }
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "Invoice",
          recordId: inv.id,
          newData: toJson({ ...inv, doIds: dos.map((d) => d.id), termDays }),
        },
      });
      return inv;
    });

    revalidateBilling(invoice.id);
    return {
      success: true,
      data: { id: invoice.id, invoiceNumber: invoice.invoiceNumber },
    };
  } catch (e) {
    return fail(e, "Gagal membuat invoice");
  }
}

// ─── Payments ────────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  date: z.string().min(1, "Tanggal bayar wajib"),
  amount: z.coerce.number().min(0),
  withholdingAmount: z.coerce.number().min(0).default(0),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.TRANSFER),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type RecordPaymentInput = z.infer<typeof paymentSchema>;

export async function recordInvoicePayment(
  raw: RecordPaymentInput
): Promise<ActionResult<{ id: string; status: InvoiceStatus }>> {
  try {
    const session = await assertBillingWrite();
    const parsed = paymentSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const data = parsed.data;
    if (data.amount + data.withholdingAmount <= 0) {
      return { success: false, error: "Nominal bayar atau PPh 23 harus > 0" };
    }
    const date = tryParseDateOnly(data.date);
    if (!date) return { success: false, error: "Tanggal bayar tidak valid" };

    const inv = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!inv) return { success: false, error: "Invoice tidak ditemukan" };
    if (inv.status === InvoiceStatus.CANCELLED) {
      return { success: false, error: "Invoice sudah dibatalkan" };
    }
    const outstanding = inv.totalAmount - inv.paidAmount - inv.withholdingAmount;
    if (data.amount + data.withholdingAmount > outstanding + TOLERANCE) {
      return {
        success: false,
        error: `Melebihi sisa tagihan (${Math.round(outstanding).toLocaleString("id-ID")})`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: inv.id,
          date,
          amount: data.amount,
          withholdingAmount: data.withholdingAmount,
          method: data.method,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          createdById: session.user.id,
        },
      });
      const updated = await recalcInvoice(tx, inv.id);
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.CREATE,
          tableName: "InvoicePayment",
          recordId: payment.id,
          newData: toJson({ ...payment, invoiceStatus: updated.status }),
        },
      });
      return { payment, status: updated.status };
    });

    revalidateBilling(inv.id);
    return { success: true, data: { id: result.payment.id, status: result.status } };
  } catch (e) {
    return fail(e, "Gagal mencatat pembayaran");
  }
}

/** Hapus pembayaran yang salah input (kas masuk ikut hilang). */
export async function deleteInvoicePayment(
  paymentId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBillingWrite();
    const payment = await prisma.invoicePayment.findUnique({ where: { id: paymentId } });
    if (!payment) return { success: false, error: "Pembayaran tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.delete({ where: { id: paymentId } });
      await recalcInvoice(tx, payment.invoiceId);
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.DELETE,
          tableName: "InvoicePayment",
          recordId: paymentId,
          oldData: toJson(payment),
        },
      });
    });

    revalidateBilling(payment.invoiceId);
    return { success: true, data: { id: paymentId } };
  } catch (e) {
    return fail(e, "Gagal menghapus pembayaran");
  }
}

// ─── Invoice maintenance ─────────────────────────────────────────────────────

const invoiceDetailsSchema = z.object({
  invoiceId: z.string().min(1),
  dueDate: z.string().min(1, "Jatuh tempo wajib"),
  periodStart: z.string().min(1, "Periode awal wajib"),
  periodEnd: z.string().min(1, "Periode akhir wajib"),
});

export type UpdateInvoiceDetailsInput = z.infer<typeof invoiceDetailsSchema>;

/** Ubah jatuh tempo & periode tagihan (label di invoice, tidak mengubah isi DO). */
export async function updateInvoiceDetails(
  raw: UpdateInvoiceDetailsInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBillingWrite();
    const parsed = invoiceDetailsSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const { invoiceId } = parsed.data;
    const dueDate = tryParseDateOnly(parsed.data.dueDate);
    const periodStart = tryParseDateOnly(parsed.data.periodStart);
    const periodEnd = tryParseDateOnly(parsed.data.periodEnd);
    if (!dueDate) return { success: false, error: "Tanggal jatuh tempo tidak valid" };
    if (!periodStart || !periodEnd) return { success: false, error: "Periode tidak valid" };
    if (periodEnd < periodStart) {
      return { success: false, error: "Periode akhir tidak boleh sebelum periode awal" };
    }
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) return { success: false, error: "Invoice tidak ditemukan" };
    if (inv.status === InvoiceStatus.CANCELLED) {
      return { success: false, error: "Invoice sudah dibatalkan" };
    }
    if (dueDate < inv.invoiceDate) {
      return { success: false, error: "Jatuh tempo tidak boleh sebelum tanggal invoice" };
    }
    await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { dueDate, periodStart, periodEnd },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "Invoice",
          recordId: invoiceId,
          oldData: toJson({
            dueDate: inv.dueDate,
            periodStart: inv.periodStart,
            periodEnd: inv.periodEnd,
          }),
          newData: toJson({
            dueDate: updated.dueDate,
            periodStart: updated.periodStart,
            periodEnd: updated.periodEnd,
          }),
        },
      });
    });
    revalidateBilling(invoiceId);
    return { success: true, data: { id: invoiceId } };
  } catch (e) {
    return fail(e, "Gagal update invoice");
  }
}

/** Batalkan invoice yang belum ada pembayaran — DO kembali VERIFIED & bisa ditagih ulang. */
export async function cancelInvoice(
  invoiceId: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertBillingWrite();
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { _count: { select: { payments: true } } },
    });
    if (!inv) return { success: false, error: "Invoice tidak ditemukan" };
    if (inv.status === InvoiceStatus.CANCELLED) {
      return { success: false, error: "Invoice sudah dibatalkan" };
    }
    if (inv._count.payments > 0) {
      return {
        success: false,
        error: "Hapus dulu semua pembayaran sebelum membatalkan invoice",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryOrder.updateMany({
        where: { invoiceId },
        data: { invoiceId: null, status: DeliveryOrderStatus.VERIFIED },
      });
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.CANCELLED,
          notes: [inv.notes, reason ? `Batal: ${reason}` : "Dibatalkan"]
            .filter(Boolean)
            .join(" | "),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: AuditAction.UPDATE,
          tableName: "Invoice",
          recordId: invoiceId,
          oldData: toJson(inv),
          newData: toJson(updated),
        },
      });
    });

    revalidateBilling(invoiceId);
    return { success: true, data: { id: invoiceId } };
  } catch (e) {
    return fail(e, "Gagal membatalkan invoice");
  }
}
