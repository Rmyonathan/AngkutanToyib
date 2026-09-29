import { DeliveryOrderStatus, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnlyRange, diffDays, formatDateOnly, todayDateOnly } from "@/lib/dates";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Belum Dibayar",
  PARTIAL: "Dibayar Sebagian",
  PAID: "Lunas",
  CANCELLED: "Dibatalkan",
};

export type UnbilledDo = {
  id: string;
  internalTripId: string;
  date: string;
  unitNumber: string;
  driverName: string;
  ticketNumber: string | null;
  netto: number;
  ratePerTon: number;
  amount: number;
};

export type UnbilledGroup = {
  customerId: string | null;
  customerName: string;
  paymentTermDays: number;
  dos: UnbilledDo[];
  totalTonase: number;
  totalAmount: number;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  withholdingAmount: number;
  outstanding: number;
  status: InvoiceStatus;
  statusLabel: string;
  /** > 0 = lewat jatuh tempo; ≤ 0 = sisa hari sebelum jatuh tempo */
  daysOverdue: number;
  doCount: number;
  totalTonase: number;
};

export type AgingBuckets = {
  notDue: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
};

export type ReceivablesSummary = {
  /** DO verified yang belum ditagih (belum jadi invoice) */
  unbilledAmount: number;
  unbilledCount: number;
  /** Sisa tagihan invoice yang belum lunas */
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  openInvoiceCount: number;
  aging: AgingBuckets;
  /** Total piutang = belum ditagih + sisa invoice */
  totalReceivable: number;
};

export type PaymentHistoryRow = {
  id: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  withholdingAmount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
};

export type ReceivablesData = {
  today: string;
  summary: ReceivablesSummary;
  unbilled: UnbilledGroup[];
  invoices: InvoiceRow[];
  payments: PaymentHistoryRow[];
};

const OPEN_STATUSES: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL];

function outstandingOf(i: {
  totalAmount: number;
  paidAmount: number;
  withholdingAmount: number;
}) {
  return Math.max(0, i.totalAmount - i.paidAmount - i.withholdingAmount);
}

function bucketFor(daysOverdue: number): keyof AgingBuckets {
  if (daysOverdue <= 0) return "notDue";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90plus";
}

/** Lightweight totals — used by Kas page & dashboard. */
export async function getReceivablesSummary(): Promise<ReceivablesSummary> {
  return (await getReceivables({ invoiceLimit: 0 })).summary;
}

export async function getReceivables(
  opts: { invoiceLimit?: number } = {}
): Promise<ReceivablesData> {
  const today = todayDateOnly();

  const [unbilledDos, openInvoices, recentInvoices, payments] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where: {
        status: DeliveryOrderStatus.VERIFIED,
        invoiceId: null,
        netto: { gt: 0 },
      },
      include: {
        unit: { select: { unitNumber: true } },
        driver: { select: { name: true } },
        customer: {
          select: { id: true, customerName: true, paymentTermDays: true, ratePerTon: true },
        },
      },
      orderBy: [{ date: "asc" }, { internalTripId: "asc" }],
    }),
    prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: {
        customer: { select: { customerName: true } },
        _count: { select: { deliveryOrders: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    opts.invoiceLimit === 0
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          where: { status: { notIn: OPEN_STATUSES } },
          include: {
            customer: { select: { customerName: true } },
            _count: { select: { deliveryOrders: true } },
          },
          orderBy: { invoiceDate: "desc" },
          take: opts.invoiceLimit ?? 50,
        }),
    opts.invoiceLimit === 0
      ? Promise.resolve([])
      : prisma.invoicePayment.findMany({
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                customer: { select: { customerName: true } },
              },
            },
            createdBy: { select: { name: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
  ]);

  // ── unbilled, grouped by customer ──
  const groups = new Map<string, UnbilledGroup>();
  for (const d of unbilledDos) {
    const key = d.customer?.id ?? "__none__";
    let g = groups.get(key);
    if (!g) {
      g = {
        customerId: d.customer?.id ?? null,
        customerName: d.customer?.customerName ?? "Tanpa customer",
        paymentTermDays: d.customer?.paymentTermDays ?? 0,
        dos: [],
        totalTonase: 0,
        totalAmount: 0,
      };
      groups.set(key, g);
    }
    const netto = d.netto ?? 0;
    const rate = d.ratePerTon || d.customer?.ratePerTon || 0;
    const amount = Math.round(netto * rate);
    g.dos.push({
      id: d.id,
      internalTripId: d.internalTripId,
      date: formatDateOnly(d.date),
      unitNumber: d.unit.unitNumber,
      driverName: d.driver.name,
      ticketNumber: d.ticketNumber,
      netto,
      ratePerTon: rate,
      amount,
    });
    g.totalTonase += netto;
    g.totalAmount += amount;
  }
  const unbilled = Array.from(groups.values()).sort((a, b) => {
    if (!a.customerId) return 1;
    if (!b.customerId) return -1;
    return a.customerName.localeCompare(b.customerName);
  });

  // ── invoices ──
  const toRow = (i: (typeof openInvoices)[number]): InvoiceRow => {
    const dueDate = formatDateOnly(i.dueDate);
    const outstanding = outstandingOf(i);
    return {
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customer.customerName,
      invoiceDate: formatDateOnly(i.invoiceDate),
      dueDate,
      totalAmount: i.totalAmount,
      paidAmount: i.paidAmount,
      withholdingAmount: i.withholdingAmount,
      outstanding,
      status: i.status,
      statusLabel: INVOICE_STATUS_LABEL[i.status],
      daysOverdue: outstanding > 0 ? diffDays(dueDate, today) : 0,
      doCount: i._count.deliveryOrders,
      totalTonase: i.totalTonase,
    };
  };
  const openRows = openInvoices.map(toRow);

  const aging: AgingBuckets = { notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  let outstandingAmount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const r of openRows) {
    outstandingAmount += r.outstanding;
    aging[bucketFor(r.daysOverdue)] += r.outstanding;
    if (r.daysOverdue > 0 && r.outstanding > 0) {
      overdueAmount += r.outstanding;
      overdueCount += 1;
    }
  }
  const unbilledAmount = unbilled.reduce((s, g) => s + g.totalAmount, 0);

  return {
    today,
    summary: {
      unbilledAmount,
      unbilledCount: unbilledDos.length,
      outstandingAmount,
      overdueAmount,
      overdueCount,
      openInvoiceCount: openRows.length,
      aging,
      totalReceivable: unbilledAmount + outstandingAmount,
    },
    unbilled,
    invoices: [...openRows, ...recentInvoices.map(toRow)],
    payments: payments.map((p) => ({
      id: p.id,
      date: formatDateOnly(p.date),
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.invoiceNumber,
      customerName: p.invoice.customer.customerName,
      amount: p.amount,
      withholdingAmount: p.withholdingAmount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      createdByName: p.createdBy?.name ?? null,
    })),
  };
}

export async function getInvoiceDetail(id: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      deliveryOrders: {
        include: {
          unit: { select: { unitNumber: true } },
          driver: { select: { name: true } },
          customerTrip: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { internalTripId: "asc" }],
      },
      payments: {
        include: { createdBy: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!inv) return null;
  const today = todayDateOnly();
  const dueDate = formatDateOnly(inv.dueDate);
  const outstanding = outstandingOf(inv);
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    statusLabel: INVOICE_STATUS_LABEL[inv.status],
    invoiceDate: formatDateOnly(inv.invoiceDate),
    dueDate,
    periodStart: formatDateOnly(inv.periodStart),
    periodEnd: formatDateOnly(inv.periodEnd),
    totalTonase: inv.totalTonase,
    ratePerTon: inv.ratePerTon,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    withholdingAmount: inv.withholdingAmount,
    outstanding,
    daysOverdue: outstanding > 0 ? diffDays(dueDate, today) : 0,
    notes: inv.notes,
    createdByName: inv.createdBy?.name ?? null,
    customer: {
      name: inv.customer.customerName,
      loadingLocation: inv.customer.loadingLocation,
      dumpingLocation: inv.customer.dumpingLocation,
      paymentTermDays: inv.customer.paymentTermDays,
    },
    dos: inv.deliveryOrders.map((d) => ({
      id: d.id,
      internalTripId: d.internalTripId,
      date: formatDateOnly(d.date),
      unitNumber: d.unit.unitNumber,
      driverName: d.driver.name,
      ticketNumber: d.ticketNumber,
      tripName: d.customerTrip?.name ?? null,
      netto: d.netto ?? 0,
      ratePerTon: d.ratePerTon,
      amount: Math.round((d.netto ?? 0) * d.ratePerTon),
    })),
    payments: inv.payments.map((p) => ({
      id: p.id,
      date: formatDateOnly(p.date),
      amount: p.amount,
      withholdingAmount: p.withholdingAmount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      createdByName: p.createdBy?.name ?? null,
    })),
  };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

export type PaymentHistoryFilter = {
  from: string;
  to: string;
  customerId?: string | null;
  method?: string | null;
};

export type PaymentHistoryData = {
  filter: PaymentHistoryFilter;
  rows: PaymentHistoryRow[];
  totalAmount: number;
  totalWithholding: number;
  byCustomer: { customerName: string; count: number; amount: number; withholding: number }[];
  byMethod: { method: string; count: number; amount: number }[];
  customers: { id: string; label: string }[];
  truncated: boolean;
};

const PAYMENT_HISTORY_LIMIT = 2000;

export async function getPaymentHistory(
  filter: PaymentHistoryFilter
): Promise<PaymentHistoryData> {
  const method = Object.values(PaymentMethod).includes(filter.method as PaymentMethod)
    ? (filter.method as PaymentMethod)
    : null;

  const [payments, customers] = await Promise.all([
    prisma.invoicePayment.findMany({
      where: {
        date: dateOnlyRange(filter.from, filter.to),
        ...(method ? { method } : {}),
        ...(filter.customerId ? { invoice: { customerId: filter.customerId } } : {}),
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customer: { select: { customerName: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: PAYMENT_HISTORY_LIMIT + 1,
    }),
    prisma.masterCustomer.findMany({
      select: { id: true, customerName: true },
      orderBy: { customerName: "asc" },
    }),
  ]);

  const truncated = payments.length > PAYMENT_HISTORY_LIMIT;
  const rows: PaymentHistoryRow[] = payments.slice(0, PAYMENT_HISTORY_LIMIT).map((p) => ({
    id: p.id,
    date: formatDateOnly(p.date),
    invoiceId: p.invoice.id,
    invoiceNumber: p.invoice.invoiceNumber,
    customerName: p.invoice.customer.customerName,
    amount: p.amount,
    withholdingAmount: p.withholdingAmount,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    createdByName: p.createdBy?.name ?? null,
  }));

  const byCustomer = new Map<string, PaymentHistoryData["byCustomer"][number]>();
  const byMethod = new Map<string, PaymentHistoryData["byMethod"][number]>();
  let totalAmount = 0;
  let totalWithholding = 0;
  for (const r of rows) {
    totalAmount += r.amount;
    totalWithholding += r.withholdingAmount;
    const c = byCustomer.get(r.customerName) ?? {
      customerName: r.customerName,
      count: 0,
      amount: 0,
      withholding: 0,
    };
    c.count += 1;
    c.amount += r.amount;
    c.withholding += r.withholdingAmount;
    byCustomer.set(r.customerName, c);
    const m = byMethod.get(r.method) ?? { method: r.method, count: 0, amount: 0 };
    m.count += 1;
    m.amount += r.amount;
    byMethod.set(r.method, m);
  }

  return {
    filter: { ...filter, method },
    rows,
    totalAmount,
    totalWithholding,
    byCustomer: Array.from(byCustomer.values()).sort((a, b) => b.amount - a.amount),
    byMethod: Array.from(byMethod.values()).sort((a, b) => b.amount - a.amount),
    customers: customers.map((c) => ({ id: c.id, label: c.customerName })),
    truncated,
  };
}