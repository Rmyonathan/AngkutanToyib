"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Kpi } from "@/components/finance/finance-shared";
import { PAYMENT_METHOD_LABEL } from "@/components/finance/piutang-client";
import type { PaymentHistoryData } from "@/lib/finance/receivables";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import { addMonths, monthEnd, monthStart } from "@/lib/dates";
import { formatRupiah } from "@/lib/utils";

export function PaymentHistoryView({
  data,
  today,
}: {
  data: PaymentHistoryData;
  today: string;
}) {
  const { filter } = data;
  const lastMonth = addMonths(monthStart(today), -1);
  const presetHref = (from: string, to: string) => {
    const sp = new URLSearchParams({ from, to });
    if (filter.customerId) sp.set("customerId", filter.customerId);
    if (filter.method) sp.set("method", filter.method);
    return `/finance/pembayaran?${sp.toString()}`;
  };

  function exportCsv() {
    const csv = toCsv(data.rows, [
      { header: "Tanggal Bayar", value: (r) => r.date },
      { header: "No. Invoice", value: (r) => r.invoiceNumber },
      { header: "Customer", value: (r) => r.customerName },
      { header: "Metode", value: (r) => PAYMENT_METHOD_LABEL[r.method] ?? r.method },
      { header: "Kas Masuk", value: (r) => Math.round(r.amount) },
      { header: "PPh 23", value: (r) => Math.round(r.withholdingAmount) },
      { header: "Referensi", value: (r) => r.reference },
      { header: "Catatan", value: (r) => r.notes },
      { header: "Dicatat oleh", value: (r) => r.createdByName },
    ]);
    downloadCsv(`riwayat-pembayaran_${filter.from}_${filter.to}`, csv);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Riwayat Pembayaran</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Semua pembayaran customer atas invoice. Setiap baris = kas masuk di tanggal bayar.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={data.rows.length === 0}>
          <Download className="mr-1.5 h-4 w-4" />
          Export Excel (CSV)
        </Button>
      </header>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <Label>Dari</Label>
          <Input type="date" name="from" defaultValue={filter.from} />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input type="date" name="to" defaultValue={filter.to} />
        </div>
        <div>
          <Label>Customer</Label>
          <Select name="customerId" defaultValue={filter.customerId ?? ""}>
            <option value="">Semua customer</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Metode</Label>
          <Select name="method" defaultValue={filter.method ?? ""}>
            <option value="">Semua metode</option>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Tampilkan
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs sm:col-span-full">
          <span className="text-neutral-400">Cepat:</span>
          <Link className="font-medium hover:underline" href={presetHref(monthStart(today), today)}>
            Bulan ini
          </Link>
          <Link className="font-medium hover:underline" href={presetHref(lastMonth, monthEnd(lastMonth))}>
            Bulan lalu
          </Link>
          <Link className="font-medium hover:underline" href={presetHref(`${today.slice(0, 4)}-01-01`, today)}>
            Tahun ini
          </Link>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi
          title="Total Kas Masuk"
          value={formatRupiah(data.totalAmount)}
          sub={`${filter.from} s/d ${filter.to}`}
        />
        <Kpi
          title="PPh 23 Dipotong"
          value={formatRupiah(data.totalWithholding)}
          muted
          sub="Bukan kas — simpan bukti potong"
        />
        <Kpi title="Jumlah Pembayaran" value={String(data.rows.length)} muted />
      </section>

      {data.rows.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          <SummaryTable
            title="Per Customer"
            head={["Customer", "Trx", "Kas Masuk", "PPh 23"]}
            rows={data.byCustomer.map((c) => [
              c.customerName,
              String(c.count),
              formatRupiah(c.amount),
              formatRupiah(c.withholding),
            ])}
          />
          <SummaryTable
            title="Per Metode"
            head={["Metode", "Trx", "Kas Masuk"]}
            rows={data.byMethod.map((m) => [
              PAYMENT_METHOD_LABEL[m.method] ?? m.method,
              String(m.count),
              formatRupiah(m.amount),
            ])}
          />
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
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
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                  Tidak ada pembayaran pada periode / filter ini.
                </td>
              </tr>
            ) : (
              data.rows.map((p) => (
                <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="px-3 py-2 whitespace-nowrap">{p.date}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/finance/piutang/${p.invoiceId}?from=pembayaran`}
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
                  <td className="max-w-[240px] px-3 py-2 text-xs text-neutral-500">
                    {p.reference ?? "—"}
                    {p.notes && <span className="block">{p.notes}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{p.createdByName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(data.totalAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(data.totalWithholding)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        {data.truncated && (
          <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500">
            Menampilkan 2.000 pembayaran terbaru — persempit periode untuk melihat sisanya.
          </p>
        )}
      </section>
    </div>
  );
}

function SummaryTable({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-neutral-50">
              {r.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i > 0 ? "text-right tabular-nums" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
