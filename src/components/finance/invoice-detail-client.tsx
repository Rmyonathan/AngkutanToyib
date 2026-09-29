"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react";
import {
  cancelInvoice,
  deleteInvoicePayment,
  recordInvoicePayment,
  updateInvoiceDetails,
} from "@/actions/finance";
import { FormDialog } from "@/components/masters/form-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Kpi } from "@/components/finance/finance-shared";
import {
  InvoiceStatusBadge,
  PAYMENT_METHOD_LABEL as METHOD_LABEL,
} from "@/components/finance/piutang-client";
import type { InvoiceDetail } from "@/lib/finance/receivables";
import { formatNumber, formatRupiah } from "@/lib/utils";
import { todayDateOnly } from "@/lib/dates";
import { COMPANY_NAME, COMPANY_TAGLINE } from "@/lib/company";

export function InvoiceDetailClient({
  invoice,
  canWrite,
  back,
}: {
  invoice: InvoiceDetail;
  canWrite: boolean;
  back: { href: string; label: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pph23Rate, setPph23Rate] = useState(0);
  const [form, setForm] = useState({
    date: todayDateOnly(),
    amount: Math.round(invoice.outstanding),
    withholdingAmount: 0,
    method: "TRANSFER",
    reference: "",
    notes: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [details, setDetails] = useState({
    dueDate: invoice.dueDate,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
  });

  const isOpen = invoice.status === "ISSUED" || invoice.status === "PARTIAL";
  const isCancelled = invoice.status === "CANCELLED";

  function applyPph23(rate: number) {
    setPph23Rate(rate);
    const wh = Math.round(invoice.outstanding * (rate / 100));
    setForm((f) => ({
      ...f,
      withholdingAmount: wh,
      amount: Math.max(0, Math.round(invoice.outstanding) - wh),
    }));
  }

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setError(res.error ?? "Gagal");
      else router.refresh();
    });
  }

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      const res = await recordInvoicePayment({
        invoiceId: invoice.id,
        date: form.date,
        amount: form.amount,
        withholdingAmount: form.withholdingAmount,
        method: form.method as "TRANSFER",
        reference: form.reference || null,
        notes: form.notes || null,
      });
      if (res.success) {
        setPph23Rate(0);
        setForm((f) => ({ ...f, amount: 0, withholdingAmount: 0, reference: "", notes: "" }));
      }
      return res.success ? { success: true } : { success: false, error: res.error };
    });
  }

  function onDeletePayment(id: string) {
    if (!confirm("Hapus pembayaran ini? Kas masuk terkait ikut terhapus.")) return;
    run(async () => {
      const res = await deleteInvoicePayment(id);
      return res.success ? { success: true } : { success: false, error: res.error };
    });
  }

  function onCancel() {
    const reason = window.prompt("Alasan pembatalan invoice (opsional):");
    if (reason === null) return;
    run(async () => {
      const res = await cancelInvoice(invoice.id, reason || undefined);
      return res.success ? { success: true } : { success: false, error: res.error };
    });
  }

  function openEdit() {
    setDetails({
      dueDate: invoice.dueDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
    });
    setError(null);
    setEditOpen(true);
  }

  function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateInvoiceDetails({ invoiceId: invoice.id, ...details });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setEditOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur print:hidden">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
          <span className="hidden text-neutral-400 sm:inline">· {back.label}</span>
        </Link>
        <span className="text-sm font-semibold">{invoice.invoiceNumber}</span>
        <InvoiceStatusBadge status={invoice.status} label={invoice.statusLabel} />
        <span className="ml-auto text-sm text-neutral-500">
          Sisa{" "}
          <span className="font-semibold tabular-nums text-neutral-900">
            {formatRupiah(invoice.outstanding)}
          </span>
        </span>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {invoice.invoiceNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {invoice.customer.name} · {invoice.dos.length} DO · periode{" "}
            {invoice.periodStart} s/d {invoice.periodEnd}
          </p>
          <div className="mt-2">
            <InvoiceStatusBadge status={invoice.status} label={invoice.statusLabel} />
          </div>
        </div>
        <div className="flex gap-2">
          {canWrite && !isCancelled && (
            <Button type="button" variant="outline" disabled={pending} onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit Invoice
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Cetak Invoice
          </Button>
          {canWrite && isOpen && invoice.payments.length === 0 && (
            <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
              Batalkan
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Kpi title="Total Tagihan" value={formatRupiah(invoice.totalAmount)} />
        <Kpi
          title="Kas Diterima"
          value={formatRupiah(invoice.paidAmount)}
          sub={`${invoice.payments.length} pembayaran`}
        />
        <Kpi
          title="PPh 23 Dipotong"
          value={formatRupiah(invoice.withholdingAmount)}
          sub="Bukti potong dari customer"
          muted
        />
        <Kpi
          title="Sisa Piutang"
          value={formatRupiah(invoice.outstanding)}
          sub={
            isCancelled
              ? "Dibatalkan"
              : invoice.outstanding <= 0
                ? "Lunas"
                : invoice.daysOverdue > 0
                  ? `Lewat jatuh tempo ${invoice.daysOverdue} hari`
                  : `Jatuh tempo ${invoice.dueDate}`
          }
        />
      </section>

      {/* Printable invoice */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 print:border-0 print:p-0">
        <div className="flex flex-wrap justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-base font-bold uppercase tracking-wide text-neutral-900">
              {COMPANY_NAME}
            </p>
            <p className="text-xs text-neutral-500">{COMPANY_TAGLINE}</p>
            <p className="mt-3 text-lg font-bold text-neutral-900">INVOICE</p>
            <p className="text-sm text-neutral-600">{invoice.invoiceNumber}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">Tanggal</dt>
            <dd className="font-medium">{invoice.invoiceDate}</dd>
            <dt className="text-neutral-500">Jatuh tempo</dt>
            <dd className="font-medium">{invoice.dueDate}</dd>
            <dt className="text-neutral-500">Periode</dt>
            <dd className="font-medium">
              {invoice.periodStart} s/d {invoice.periodEnd}
            </dd>
          </dl>
        </div>
        <div className="py-4 text-sm">
          <p className="text-neutral-500">Kepada</p>
          <p className="font-semibold text-neutral-900">{invoice.customer.name}</p>
          <p className="text-neutral-600">
            Hauling {invoice.customer.loadingLocation} → {invoice.customer.dumpingLocation}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y border-neutral-200 text-left text-[10px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">No</th>
                <th className="px-2 py-2">Tanggal</th>
                <th className="px-2 py-2">No. Tiket</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Rute</th>
                <th className="px-2 py-2 text-right">Tonase (t)</th>
                <th className="px-2 py-2 text-right">Rate/Ton</th>
                <th className="px-2 py-2 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {invoice.dos.map((d, i) => (
                <tr key={d.id} className="border-b border-neutral-50">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{d.date}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{d.ticketNumber ?? "—"}</span>
                    <Link
                      href={`/operations/trips/${d.id}`}
                      className="block text-[11px] text-neutral-500 underline-offset-2 hover:underline print:hidden"
                    >
                      {d.internalTripId}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{d.unitNumber}</td>
                  <td className="px-2 py-1.5">{d.tripName ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatNumber(d.netto, 2)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatRupiah(d.ratePerTon)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                    {formatRupiah(d.amount)}
                  </td>
                </tr>
              ))}
              {invoice.dos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-neutral-400">
                    DO sudah dilepas (invoice dibatalkan).
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="text-sm font-semibold">
              <tr className="border-t border-neutral-200">
                <td className="px-2 py-2" colSpan={5}>
                  Total
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatNumber(invoice.totalTonase, 2)} t
                </td>
                <td />
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatRupiah(invoice.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {invoice.notes && (
          <p className="mt-4 text-xs text-neutral-500">Catatan: {invoice.notes}</p>
        )}
      </section>

      <section id="bayar" className="grid scroll-mt-32 gap-4 lg:grid-cols-5 print:hidden">
        <div className="rounded-xl border border-neutral-200 bg-white lg:col-span-3">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">Riwayat Pembayaran</h2>
            <p className="text-xs text-neutral-400">
              Setiap baris = kas masuk di tanggal bayar (muncul di Kas Keseluruhan)
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Metode</th>
                <th className="px-3 py-2 text-right">Kas Masuk</th>
                <th className="px-3 py-2 text-right">PPh 23</th>
                <th className="px-3 py-2">Ref / Oleh</th>
                {canWrite && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {invoice.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    Belum ada pembayaran.
                  </td>
                </tr>
              ) : (
                invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-50">
                    <td className="px-3 py-2 whitespace-nowrap">{p.date}</td>
                    <td className="px-3 py-2">{METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                      {formatRupiah(p.withholdingAmount)}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {p.reference ?? "—"}
                      {p.notes && <span className="block">{p.notes}</span>}
                      <span className="block text-neutral-400">{p.createdByName ?? ""}</span>
                    </td>
                    {canWrite && (
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDeletePayment(p.id)}
                          className="text-neutral-400 hover:text-neutral-900"
                          aria-label="Hapus pembayaran"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {canWrite && isOpen && (
            <form
              onSubmit={submitPayment}
              className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <p className="text-sm font-semibold">Catat Pembayaran</p>
              <p className="text-xs text-neutral-500">
                Sisa tagihan {formatRupiah(invoice.outstanding)}. Boleh dicicil.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tanggal bayar</Label>
                  <Input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Metode</Label>
                  <Select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {Object.entries(METHOD_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label>PPh 23 dipotong customer?</Label>
                <Select
                  value={String(pph23Rate)}
                  onChange={(e) => applyPph23(Number(e.target.value))}
                >
                  <option value="0">Tidak / isi manual</option>
                  <option value="2">Ya — 2% dari sisa tagihan (PPh 23)</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Kas masuk (Rp)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>PPh 23 (Rp)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.withholdingAmount || ""}
                    onChange={(e) =>
                      setForm({ ...form, withholdingAmount: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>No. referensi (transfer / giro)</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>
              <div>
                <Label>Catatan</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Menyimpan…" : "Simpan Pembayaran"}
              </Button>
            </form>
          )}
        </div>
      </section>

      <FormDialog open={editOpen} title={`Edit ${invoice.invoiceNumber}`} onClose={() => setEditOpen(false)}>
        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <Label>Jatuh tempo</Label>
            <Input
              type="date"
              required
              min={invoice.invoiceDate}
              value={details.dueDate}
              onChange={(e) => setDetails({ ...details, dueDate: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Default tanggal invoice ({invoice.invoiceDate}) + tempo customer (
              {invoice.customer.paymentTermDays} hari).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Periode dari</Label>
              <Input
                type="date"
                required
                value={details.periodStart}
                onChange={(e) => setDetails({ ...details, periodStart: e.target.value })}
              />
            </div>
            <div>
              <Label>Periode sampai</Label>
              <Input
                type="date"
                required
                min={details.periodStart}
                value={details.periodEnd}
                onChange={(e) => setDetails({ ...details, periodEnd: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-400">
            Periode hanya keterangan di invoice — daftar DO & total tagihan tidak berubah.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
