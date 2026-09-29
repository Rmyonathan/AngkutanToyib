"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileText, Wallet } from "lucide-react";
import { createInvoiceFromDos } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Kpi } from "@/components/finance/finance-shared";
import type {
  InvoiceRow,
  PaymentHistoryRow,
  ReceivablesData,
  UnbilledGroup,
} from "@/lib/finance/receivables";
import { formatNumber, formatRupiah } from "@/lib/utils";
import { addDays } from "@/lib/dates";

export function PiutangClient({
  data,
  canWrite,
}: {
  data: ReceivablesData;
  canWrite: boolean;
}) {
  const s = data.summary;
  const aging = [
    { label: "Belum jatuh tempo", value: s.aging.notDue },
    { label: "Lewat 1–30 hari", value: s.aging.d1_30 },
    { label: "Lewat 31–60 hari", value: s.aging.d31_60 },
    { label: "Lewat 61–90 hari", value: s.aging.d61_90 },
    { label: "Lewat > 90 hari", value: s.aging.d90plus },
  ];
  const agingMax = Math.max(1, ...aging.map((a) => a.value));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">Penagihan & Piutang</h1>
        <p className="mt-1 text-sm text-neutral-500">
          DO verified → buat invoice (tempo sesuai customer) → catat pembayaran
          saat uang masuk. Kas masuk hanya tercatat ketika pembayaran dicatat.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Total Piutang"
          value={formatRupiah(s.totalReceivable)}
          sub="Belum ditagih + sisa invoice"
        />
        <Kpi
          title="Belum Ditagih"
          value={formatRupiah(s.unbilledAmount)}
          sub={`${s.unbilledCount} DO verified tanpa invoice`}
        />
        <Kpi
          title="Sisa Tagihan Invoice"
          value={formatRupiah(s.outstandingAmount)}
          sub={`${s.openInvoiceCount} invoice belum lunas`}
        />
        <Kpi
          title="Lewat Jatuh Tempo"
          value={formatRupiah(s.overdueAmount)}
          sub={`${s.overdueCount} invoice overdue`}
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Umur Piutang (Aging)</h2>
        <p className="text-xs text-neutral-400">Sisa tagihan invoice berdasarkan jatuh tempo</p>
        <ul className="mt-3 space-y-2 text-sm">
          {aging.map((a) => (
            <li key={a.label} className="grid grid-cols-[150px_1fr_130px] items-center gap-3">
              <span className="text-neutral-600">{a.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className="block h-full rounded-full bg-neutral-900"
                  style={{ width: `${(a.value / agingMax) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums font-medium">
                {formatRupiah(a.value)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Siap Ditagih</h2>
          <p className="text-xs text-neutral-400">
            DO status Verified Timbangan yang belum masuk invoice, per customer
          </p>
        </div>
        {data.unbilled.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Semua DO verified sudah ditagih.
          </p>
        ) : (
          data.unbilled.map((g) => (
            <UnbilledCard
              key={g.customerId ?? "none"}
              group={g}
              today={data.today}
              canWrite={canWrite}
            />
          ))
        )}
      </section>

      <InvoiceTable invoices={data.invoices} canWrite={canWrite} />

      <PaymentHistory payments={data.payments} />
    </div>
  );
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  TRANSFER: "Transfer",
  CASH: "Tunai",
  GIRO: "Giro / Cek",
  OTHER: "Lainnya",
};

function PaymentHistory({ payments }: { payments: PaymentHistoryRow[] }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Pembayaran Terakhir</h2>
          <p className="text-xs text-neutral-400">
            5 pembayaran terbaru. Filter, total per customer & export ada di Riwayat Pembayaran.
          </p>
        </div>
        <Link
          href="/finance/pembayaran"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
        >
          Lihat semua riwayat →
        </Link>
      </div>
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2">Tgl Bayar</th>
            <th className="px-3 py-2">No. Invoice</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Metode</th>
            <th className="px-3 py-2 text-right">Kas Masuk</th>
            <th className="px-3 py-2 text-right">PPh 23</th>
            <th className="px-3 py-2">Referensi / Catatan</th>
            <th className="px-3 py-2">Dicatat oleh</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                Belum ada pembayaran tercatat.
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                <td className="px-3 py-2 whitespace-nowrap">{p.date}</td>
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/finance/piutang/${p.invoiceId}`}
                    className="underline underline-offset-2 hover:text-neutral-600"
                  >
                    {p.invoiceNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.customerName}</td>
                <td className="px-3 py-2">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {formatRupiah(p.amount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                  {formatRupiah(p.withholdingAmount)}
                </td>
                <td className="max-w-[220px] px-3 py-2 text-xs text-neutral-500">
                  {p.reference ?? "—"}
                  {p.notes && <span className="block">{p.notes}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">{p.createdByName ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function UnbilledCard({
  group,
  today,
  canWrite,
}: {
  group: UnbilledGroup;
  today: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.dos.map((d) => d.id))
  );
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [termDays, setTermDays] = useState(group.paymentTermDays);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = group.dos.filter((d) => selected.has(d.id));
  const chosenAmount = chosen.reduce((s, d) => s + d.amount, 0);
  const chosenTon = chosen.reduce((s, d) => s + d.netto, 0);
  const noCustomer = !group.customerId;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createInvoiceFromDos({
        doIds: chosen.map((d) => d.id),
        invoiceDate,
        termDays,
        notes: notes || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push(`/finance/piutang/${res.data.id}`);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="font-semibold text-neutral-900">{group.customerName}</p>
          <p className="text-xs text-neutral-500">
            {group.dos.length} DO · {formatNumber(group.totalTonase, 2)} t ·{" "}
            {formatRupiah(group.totalAmount)}
            {!noCustomer && ` · tempo default ${group.paymentTermDays} hari`}
          </p>
        </div>
      </div>

      {noCustomer && (
        <p className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-xs text-neutral-600">
          DO ini belum punya customer. Buka DO → Edit DO → pilih trip customer,
          baru bisa ditagih.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              {canWrite && !noCustomer && <th className="w-8 px-4 py-2" />}
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Trip</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Tiket</th>
              <th className="px-3 py-2 text-right">Tonase</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Tagihan</th>
            </tr>
          </thead>
          <tbody>
            {group.dos.map((d) => (
              <tr key={d.id} className="border-b border-neutral-50">
                {canWrite && !noCustomer && (
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      aria-label={`Pilih ${d.internalTripId}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/operations/trips/${d.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {d.internalTripId}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.unitNumber}</td>
                <td className="px-3 py-2">{d.ticketNumber ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(d.netto, 2)} t
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatRupiah(d.ratePerTon)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {formatRupiah(d.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite && !noCustomer && (
        <form
          onSubmit={submit}
          className="grid gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <Label>Tanggal Invoice</Label>
            <Input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Tempo (hari)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={termDays}
              onChange={(e) => setTermDays(Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Jatuh tempo {invoiceDate ? addDays(invoiceDate, termDays || 0) : "—"}
            </p>
          </div>
          <div className="lg:col-span-2">
            <Label>Catatan</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-col justify-end">
            <Button type="submit" disabled={pending || chosen.length === 0}>
              <FileText className="mr-1.5 h-4 w-4" />
              {pending ? "Membuat…" : `Buat Invoice (${chosen.length})`}
            </Button>
            <p className="mt-1 text-right text-[11px] text-neutral-500 tabular-nums">
              {formatNumber(chosenTon, 2)} t · {formatRupiah(chosenAmount)}
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600 sm:col-span-full">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}

function InvoiceTable({
  invoices,
  canWrite,
}: {
  invoices: InvoiceRow[];
  canWrite: boolean;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Invoice</h2>
        <p className="text-xs text-neutral-400">
          Belum lunas (urut jatuh tempo) lalu riwayat lunas / batal
        </p>
      </div>
      <table className="w-full min-w-[980px] text-sm">
        <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2">No. Invoice</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Tgl Invoice</th>
            <th className="px-3 py-2">Jatuh Tempo</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Diterima</th>
            <th className="px-3 py-2 text-right">PPh 23</th>
            <th className="px-3 py-2 text-right">Sisa</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-neutral-400">
                Belum ada invoice.
              </td>
            </tr>
          ) : (
            invoices.map((i) => (
              <tr key={i.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/finance/piutang/${i.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {i.invoiceNumber}
                  </Link>
                  <span className="block text-[11px] text-neutral-400">
                    {i.doCount} DO · {formatNumber(i.totalTonase, 2)} t
                  </span>
                </td>
                <td className="px-3 py-2">{i.customerName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{i.invoiceDate}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {i.dueDate}
                  {i.outstanding > 0 && (
                    <span
                      className={`block text-[11px] ${
                        i.daysOverdue > 0 ? "font-semibold text-red-600" : "text-neutral-400"
                      }`}
                    >
                      {i.daysOverdue > 0
                        ? `lewat ${i.daysOverdue} hari`
                        : i.daysOverdue === 0
                          ? "jatuh tempo hari ini"
                          : `${-i.daysOverdue} hari lagi`}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatRupiah(i.totalAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatRupiah(i.paidAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                  {formatRupiah(i.withholdingAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {formatRupiah(i.outstanding)}
                </td>
                <td className="px-3 py-2">
                  <InvoiceStatusBadge status={i.status} label={i.statusLabel} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canWrite && i.outstanding > 0 && i.status !== "CANCELLED" ? (
                    <Link
                      href={`/finance/piutang/${i.id}#bayar`}
                      className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Bayar
                    </Link>
                  ) : (
                    <Link
                      href={`/finance/piutang/${i.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Lihat
                    </Link>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function InvoiceStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone =
    status === "PAID"
      ? "border-neutral-900 bg-neutral-900 text-white"
      : status === "CANCELLED"
        ? "border-neutral-200 bg-white text-neutral-400 line-through"
        : "border-neutral-300 bg-neutral-50 text-neutral-700";
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}
