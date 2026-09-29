"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Kpi } from "@/components/finance/finance-shared";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import type { OperationsReport } from "@/lib/reports/get-operations-report";
import { formatNumber, formatRupiah } from "@/lib/utils";
import { addMonths, monthEnd, todayDateOnly } from "@/lib/dates";

type Opt = { id: string; label: string };
type Tab = "do" | "unit" | "customer" | "harian";

const TABS: { id: Tab; label: string }[] = [
  { id: "do", label: "Per DO / Trip" },
  { id: "unit", label: "Rekap per Unit" },
  { id: "customer", label: "Rekap per Customer" },
  { id: "harian", label: "Rekap Harian" },
];

function monthRange(offset = 0) {
  const today = todayDateOnly();
  const from = addMonths(today, offset);
  return { from, to: offset === 0 ? today : monthEnd(from) };
}

export function OperationsReportView({
  report,
  units,
  customers,
}: {
  report: OperationsReport;
  units: Opt[];
  customers: Opt[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("do");
  const [from, setFrom] = useState(report.period.from);
  const [to, setTo] = useState(report.period.to);
  const [unitId, setUnitId] = useState(report.filters.unitId ?? "");
  const [customerId, setCustomerId] = useState(
    report.filters.customerId ?? ""
  );

  function apply(next?: Partial<{ from: string; to: string }>) {
    const q = new URLSearchParams();
    q.set("from", next?.from ?? from);
    q.set("to", next?.to ?? to);
    if (unitId) q.set("unitId", unitId);
    if (customerId) q.set("customerId", customerId);
    router.push(`/reports?${q.toString()}`);
  }

  function preset(offset: number) {
    const r = monthRange(offset);
    setFrom(r.from);
    setTo(r.to);
    apply(r);
  }

  const s = report.summary;
  const suffix = `${report.period.from}_${report.period.to}`;
  const unitLabel = units.find((u) => u.id === report.filters.unitId)?.label;
  const customerLabel = customers.find(
    (c) => c.id === report.filters.customerId
  )?.label;

  function exportCurrent() {
    if (tab === "do") {
      downloadCsv(
        `laporan-do_${suffix}`,
        toCsv(report.rows, [
          { header: "Tanggal", value: (r) => r.date },
          { header: "Trip ID", value: (r) => r.internalTripId },
          { header: "Unit", value: (r) => r.unitNumber },
          { header: "Driver", value: (r) => r.driverName },
          { header: "Customer", value: (r) => r.customerName ?? "" },
          { header: "Trip", value: (r) => r.tripName ?? "" },
          { header: "No Tiket", value: (r) => r.ticketNumber ?? "" },
          { header: "Tonase (t)", value: (r) => r.netto },
          { header: "Rate/Ton", value: (r) => r.ratePerTon },
          { header: "Revenue", value: (r) => Math.round(r.revenue) },
          { header: "Uang Jalan", value: (r) => r.uangJalan },
          { header: "Solar (Rp)", value: (r) => r.solarCost },
          { header: "Solar (L)", value: (r) => r.solarLiters },
          { header: "Biaya Lain", value: (r) => r.otherCost },
          { header: "Total Ongkosan", value: (r) => r.ongkosan },
          { header: "Untung", value: (r) => Math.round(r.untung) },
          { header: "Status", value: (r) => r.status },
        ])
      );
    } else if (tab === "unit") {
      downloadCsv(
        `rekap-unit_${suffix}`,
        toCsv(report.perUnit, [
          { header: "Unit", value: (r) => r.unitNumber },
          { header: "Ritase", value: (r) => r.ritase },
          { header: "Tonase (t)", value: (r) => r.tonase },
          { header: "Revenue", value: (r) => Math.round(r.revenue) },
          { header: "Uang Jalan", value: (r) => r.uangJalan },
          { header: "Solar (Rp)", value: (r) => r.solarCost },
          { header: "Solar (L)", value: (r) => r.solarLiters },
          { header: "Biaya Lain", value: (r) => r.otherCost },
          { header: "Biaya Tanpa Trip", value: (r) => r.unlinkedCost },
          { header: "Total Ongkosan", value: (r) => r.ongkosan },
          { header: "Untung", value: (r) => Math.round(r.untung) },
        ])
      );
    } else if (tab === "customer") {
      downloadCsv(
        `rekap-customer_${suffix}`,
        toCsv(report.perCustomer, [
          { header: "Customer", value: (r) => r.customerName },
          { header: "Ritase", value: (r) => r.ritase },
          { header: "Tonase (t)", value: (r) => r.tonase },
          { header: "Rata Rate/Ton", value: (r) => Math.round(r.avgRate) },
          { header: "Revenue", value: (r) => Math.round(r.revenue) },
        ])
      );
    } else {
      downloadCsv(
        `rekap-harian_${suffix}`,
        toCsv(report.perDay, [
          { header: "Tanggal", value: (r) => r.date },
          { header: "Ritase", value: (r) => r.ritase },
          { header: "Tonase (t)", value: (r) => r.tonase },
          { header: "Revenue", value: (r) => Math.round(r.revenue) },
          { header: "Ongkosan", value: (r) => r.ongkosan },
          { header: "Untung", value: (r) => Math.round(r.untung) },
        ])
      );
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Laporan</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Rekap operasional & finansial dari DO verified. Filter periode /
            unit / customer, lalu export Excel (CSV) atau cetak ke PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={exportCurrent}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Excel (CSV)
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Cetak / PDF
          </Button>
        </div>
      </header>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Laporan Operasional & Finansial</h1>
        <p className="text-sm text-neutral-600">
          Periode {report.period.from} s/d {report.period.to}
          {unitLabel ? ` · Unit ${unitLabel}` : ""}
          {customerLabel ? ` · ${customerLabel}` : ""}
        </p>
      </div>

      {/* Filters */}
      <form
        className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div>
          <Label>Dari</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Unit</Label>
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">Semua unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Customer</Label>
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Semua customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            Terapkan
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:col-span-2 lg:col-span-5">
          <span className="text-neutral-400">Cepat:</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => preset(0)}
          >
            Bulan ini
          </button>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => preset(-1)}
          >
            Bulan lalu
          </button>
        </div>
      </form>

      {/* Summary */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Ritase"
          value={String(s.ritase)}
          sub={
            s.pendingTrips > 0
              ? `+${s.pendingTrips} trip belum verified`
              : "trip verified"
          }
        />
        <Kpi
          title="Tonase"
          value={`${formatNumber(s.tonase, 2)} t`}
          sub={`Rata-rata ${formatNumber(s.avgNetto, 2)} t / rit`}
        />
        <Kpi title="Revenue" value={formatRupiah(s.revenue)} />
        <Kpi
          title="Untung"
          value={formatRupiah(s.untung)}
          sub={`Margin ${formatNumber(s.marginPercent, 1)}% · Ongkosan ${formatRupiah(s.ongkosan)}`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi muted title="Uang Jalan" value={formatRupiah(s.uangJalan)} />
        <Kpi
          muted
          title="Solar"
          value={formatRupiah(s.solarCost)}
          sub={`${formatNumber(s.solarLiters, 1)} L`}
        />
        <Kpi muted title="Biaya Lain" value={formatRupiah(s.otherCost)} />
        <Kpi
          muted
          title="Biaya Tanpa Trip"
          value={formatRupiah(s.unlinkedCost)}
          sub="Solar / lain yang tidak terhubung ke DO"
        />
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* All tables are rendered so print / PDF includes every recap;
          on screen only the active tab is visible. */}
      <div className={`${tab === "do" ? "" : "hidden"} print:block`}>
        <DoTable report={report} />
      </div>
      <div className={`${tab === "unit" ? "" : "hidden"} print:block`}>
        <UnitTable report={report} />
      </div>
      <div className={`${tab === "customer" ? "" : "hidden"} print:block`}>
        <CustomerTable report={report} />
      </div>
      <div className={`${tab === "harian" ? "" : "hidden"} print:block`}>
        <DayTable report={report} />
      </div>
    </div>
  );
}

const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500";
const td = "px-3 py-2 whitespace-nowrap";
const num = `${td} text-right tabular-nums`;

function TableShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {sub && <p className="text-xs text-neutral-400">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-neutral-400">
        Tidak ada data untuk filter ini.
      </td>
    </tr>
  );
}

function DoTable({ report }: { report: OperationsReport }) {
  const s = report.summary;
  return (
    <TableShell
      title="Per DO / Trip"
      sub="Satu baris = satu Surat Jalan verified"
    >
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b border-neutral-100">
          <tr>
            <th className={th}>Tanggal</th>
            <th className={th}>Trip</th>
            <th className={th}>Unit</th>
            <th className={th}>Driver</th>
            <th className={th}>Customer</th>
            <th className={th}>Tiket</th>
            <th className={`${th} text-right`}>Tonase</th>
            <th className={`${th} text-right`}>Rate</th>
            <th className={`${th} text-right`}>Revenue</th>
            <th className={`${th} text-right`}>Ongkosan</th>
            <th className={`${th} text-right`}>Untung</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 ? (
            <Empty cols={11} />
          ) : (
            report.rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50">
                <td className={td}>{r.date}</td>
                <td className={td}>
                  <Link
                    href={`/operations/trips/${r.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {r.internalTripId}
                  </Link>
                </td>
                <td className={td}>{r.unitNumber}</td>
                <td className={td}>{r.driverName}</td>
                <td className={td}>{r.customerName ?? "—"}</td>
                <td className={td}>{r.ticketNumber ?? "—"}</td>
                <td className={num}>{formatNumber(r.netto, 2)} t</td>
                <td className={num}>{formatRupiah(r.ratePerTon)}</td>
                <td className={num}>{formatRupiah(r.revenue)}</td>
                <td className={num}>{formatRupiah(r.ongkosan)}</td>
                <td className={`${num} font-medium`}>
                  {formatRupiah(r.untung)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {report.rows.length > 0 && (
          <tfoot className="border-t border-neutral-200 font-semibold">
            <tr>
              <td className={td} colSpan={6}>
                Total ({s.ritase} rit)
              </td>
              <td className={num}>{formatNumber(s.tonase, 2)} t</td>
              <td className={num} />
              <td className={num}>{formatRupiah(s.revenue)}</td>
              <td className={num}>
                {formatRupiah(s.uangJalan + s.solarCost + s.otherCost)}
              </td>
              <td className={num}>
                {formatRupiah(
                  s.revenue - (s.uangJalan + s.solarCost + s.otherCost)
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </TableShell>
  );
}

function UnitTable({ report }: { report: OperationsReport }) {
  const s = report.summary;
  return (
    <TableShell
      title="Rekap per Unit"
      sub="Ongkosan = uang jalan + solar + biaya lain (termasuk biaya tanpa trip)"
    >
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-neutral-100">
          <tr>
            <th className={th}>Unit</th>
            <th className={`${th} text-right`}>Ritase</th>
            <th className={`${th} text-right`}>Tonase</th>
            <th className={`${th} text-right`}>Revenue</th>
            <th className={`${th} text-right`}>Uang Jalan</th>
            <th className={`${th} text-right`}>Solar</th>
            <th className={`${th} text-right`}>Biaya Lain</th>
            <th className={`${th} text-right`}>Tanpa Trip</th>
            <th className={`${th} text-right`}>Ongkosan</th>
            <th className={`${th} text-right`}>Untung</th>
          </tr>
        </thead>
        <tbody>
          {report.perUnit.length === 0 ? (
            <Empty cols={10} />
          ) : (
            report.perUnit.map((u) => (
              <tr key={u.unitId} className="border-b border-neutral-50">
                <td className={`${td} font-medium`}>{u.unitNumber}</td>
                <td className={num}>{u.ritase}</td>
                <td className={num}>{formatNumber(u.tonase, 2)} t</td>
                <td className={num}>{formatRupiah(u.revenue)}</td>
                <td className={num}>{formatRupiah(u.uangJalan)}</td>
                <td className={num}>
                  {formatRupiah(u.solarCost)}
                  {u.solarLiters > 0 && (
                    <span className="block text-xs text-neutral-400">
                      {formatNumber(u.solarLiters, 1)} L
                    </span>
                  )}
                </td>
                <td className={num}>{formatRupiah(u.otherCost)}</td>
                <td className={num}>{formatRupiah(u.unlinkedCost)}</td>
                <td className={num}>{formatRupiah(u.ongkosan)}</td>
                <td className={`${num} font-medium`}>
                  {formatRupiah(u.untung)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {report.perUnit.length > 0 && (
          <tfoot className="border-t border-neutral-200 font-semibold">
            <tr>
              <td className={td}>Total</td>
              <td className={num}>{s.ritase}</td>
              <td className={num}>{formatNumber(s.tonase, 2)} t</td>
              <td className={num}>{formatRupiah(s.revenue)}</td>
              <td className={num}>{formatRupiah(s.uangJalan)}</td>
              <td className={num}>{formatRupiah(s.solarCost)}</td>
              <td className={num}>{formatRupiah(s.otherCost)}</td>
              <td className={num}>{formatRupiah(s.unlinkedCost)}</td>
              <td className={num}>{formatRupiah(s.ongkosan)}</td>
              <td className={num}>{formatRupiah(s.untung)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </TableShell>
  );
}

function CustomerTable({ report }: { report: OperationsReport }) {
  const s = report.summary;
  return (
    <TableShell
      title="Rekap per Customer / Project"
      sub="Dasar penagihan — tonase verified × rate"
    >
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-neutral-100">
          <tr>
            <th className={th}>Customer</th>
            <th className={`${th} text-right`}>Ritase</th>
            <th className={`${th} text-right`}>Tonase</th>
            <th className={`${th} text-right`}>Rata Rate/Ton</th>
            <th className={`${th} text-right`}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {report.perCustomer.length === 0 ? (
            <Empty cols={5} />
          ) : (
            report.perCustomer.map((c) => (
              <tr
                key={c.customerId ?? "none"}
                className="border-b border-neutral-50"
              >
                <td className={`${td} font-medium`}>{c.customerName}</td>
                <td className={num}>{c.ritase}</td>
                <td className={num}>{formatNumber(c.tonase, 2)} t</td>
                <td className={num}>{formatRupiah(c.avgRate)}</td>
                <td className={`${num} font-medium`}>
                  {formatRupiah(c.revenue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {report.perCustomer.length > 0 && (
          <tfoot className="border-t border-neutral-200 font-semibold">
            <tr>
              <td className={td}>Total</td>
              <td className={num}>{s.ritase}</td>
              <td className={num}>{formatNumber(s.tonase, 2)} t</td>
              <td className={num} />
              <td className={num}>{formatRupiah(s.revenue)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </TableShell>
  );
}

function DayTable({ report }: { report: OperationsReport }) {
  return (
    <TableShell title="Rekap Harian" sub="Produksi & untung per tanggal">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-neutral-100">
          <tr>
            <th className={th}>Tanggal</th>
            <th className={`${th} text-right`}>Ritase</th>
            <th className={`${th} text-right`}>Tonase</th>
            <th className={`${th} text-right`}>Revenue</th>
            <th className={`${th} text-right`}>Ongkosan</th>
            <th className={`${th} text-right`}>Untung</th>
          </tr>
        </thead>
        <tbody>
          {report.perDay.length === 0 ? (
            <Empty cols={6} />
          ) : (
            report.perDay.map((d) => (
              <tr key={d.date} className="border-b border-neutral-50">
                <td className={`${td} font-medium`}>{d.date}</td>
                <td className={num}>{d.ritase}</td>
                <td className={num}>{formatNumber(d.tonase, 2)} t</td>
                <td className={num}>{formatRupiah(d.revenue)}</td>
                <td className={num}>{formatRupiah(d.ongkosan)}</td>
                <td className={`${num} font-medium`}>
                  {formatRupiah(d.untung)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  );
}
