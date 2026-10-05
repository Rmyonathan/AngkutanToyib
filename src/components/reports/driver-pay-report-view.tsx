"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Kpi } from "@/components/finance/finance-shared";
import { ReportsNav } from "@/components/reports/reports-nav";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import type { DriverPayReport } from "@/lib/reports/get-driver-pay-report";
import { addMonths, monthEnd, todayDateOnly } from "@/lib/dates";
import { formatNumber, formatRupiah } from "@/lib/utils";

type Opt = { id: string; label: string };

function monthRange(offset = 0) {
  const today = todayDateOnly();
  const from = addMonths(today, offset);
  return { from, to: offset === 0 ? today : monthEnd(from) };
}

export function DriverPayReportView({
  report,
  drivers,
  initialDriverId = "",
}: {
  report: DriverPayReport;
  drivers: Opt[];
  initialDriverId?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(report.period.from);
  const [to, setTo] = useState(report.period.to);
  const [driverId, setDriverId] = useState(initialDriverId);
  const [open, setOpen] = useState<Set<string>>(new Set());

  function apply(next?: Partial<{ from: string; to: string }>) {
    const q = new URLSearchParams();
    q.set("from", next?.from ?? from);
    q.set("to", next?.to ?? to);
    if (driverId) q.set("driverId", driverId);
    router.push(`/reports/gaji-driver?${q.toString()}`);
  }

  function preset(offset: number) {
    const r = monthRange(offset);
    setFrom(r.from);
    setTo(r.to);
    apply(r);
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const suffix = `${report.period.from}_${report.period.to}`;
  const s = report.summary;

  function exportSummary() {
    downloadCsv(
      `laporan-gaji-driver_${suffix}`,
      toCsv(report.drivers, [
        { header: "Supir", value: (r) => r.driverName },
        { header: "Ritase", value: (r) => r.ritase },
        { header: "Tonase", value: (r) => Math.round(r.tonase * 1000) / 1000 },
        { header: "Total Gaji", value: (r) => Math.round(r.totalGaji) },
      ])
    );
  }

  function exportTrips() {
    const flat = report.drivers.flatMap((d) =>
      d.trips.map((t) => ({ ...t, driverName: d.driverName }))
    );
    downloadCsv(
      `laporan-gaji-driver-detail_${suffix}`,
      toCsv(flat, [
        { header: "Supir", value: (r) => r.driverName },
        { header: "Tanggal", value: (r) => r.date },
        { header: "Trip ID", value: (r) => r.internalTripId },
        { header: "Unit", value: (r) => r.unitNumber },
        { header: "Customer", value: (r) => r.customerName ?? "" },
        { header: "Rute", value: (r) => r.tripName ?? "" },
        { header: "Tonase", value: (r) => r.netto },
        { header: "Jenis Gaji", value: (r) => r.payModeLabel },
        { header: "Nominal DO", value: (r) => r.payNominal },
        { header: "Gaji Trip", value: (r) => Math.round(r.gaji) },
      ])
    );
  }

  const th =
    "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500";
  const td = "px-3 py-2 text-sm text-neutral-800";
  const num = `${td} text-right tabular-nums`;

  return (
    <div>
      <ReportsNav />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Laporan Gaji Driver</h1>
          <p className="text-sm text-neutral-500">
            Akumulasi gaji per supir dari input DO (per ton / per trip). Klik baris
            untuk lihat rincian trip.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportSummary}>
            <Download className="mr-1 h-4 w-4" />
            CSV Rekap
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportTrips}>
            <Download className="mr-1 h-4 w-4" />
            CSV Detail Trip
          </Button>
        </div>
      </header>

      <form
        className="mb-4 grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div>
          <Label>Dari</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Supir</Label>
          <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Semua supir</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-2">
          <Button type="submit">Terapkan</Button>
          <Button type="button" variant="outline" onClick={() => preset(0)}>
            Bulan ini
          </Button>
          <Button type="button" variant="outline" onClick={() => preset(-1)}>
            Bulan lalu
          </Button>
        </div>
      </form>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Periode" value={`${report.period.from} → ${report.period.to}`} />
        <Kpi title="Supir" value={String(s.driverCount)} sub={`${s.ritase} ritase`} />
        <Kpi
          title="Tonase"
          value={`${formatNumber(s.tonase, 3)} ton`}
          sub="DO terverifikasi / ditagih / lunas"
        />
        <Kpi title="Total Gaji" value={formatRupiah(s.totalGaji)} />
      </section>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className={th} />
              <th className={th}>Supir</th>
              <th className={`${th} text-right`}>Ritase</th>
              <th className={`${th} text-right`}>Tonase</th>
              <th className={`${th} text-right`}>Total Gaji</th>
            </tr>
          </thead>
          <tbody>
            {report.drivers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-neutral-400">
                  Tidak ada DO pada periode ini.
                </td>
              </tr>
            ) : (
              report.drivers.map((d) => {
                const expanded = open.has(d.driverId);
                return (
                  <Fragment key={d.driverId}>
                    <tr
                      className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
                      onClick={() => toggle(d.driverId)}
                    >
                      <td className={`${td} w-8 text-neutral-500`}>
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className={`${td} font-medium`}>{d.driverName}</td>
                      <td className={num}>{d.ritase}</td>
                      <td className={num}>{formatNumber(d.tonase, 3)}</td>
                      <td className={`${num} font-semibold`}>
                        {formatRupiah(d.totalGaji)}
                      </td>
                    </tr>
                    {expanded &&
                      d.trips.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-neutral-50 bg-neutral-50/80"
                        >
                          <td className={td} />
                          <td className={td} colSpan={2}>
                            <Link
                              href={`/operations/trips/${t.id}`}
                              className="font-medium underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t.internalTripId}
                            </Link>
                            <span className="ml-2 text-xs text-neutral-500">
                              {t.date} · {t.unitNumber}
                              {t.tripName ? ` · ${t.tripName}` : ""}
                            </span>
                          </td>
                          <td className={num}>{formatNumber(t.netto, 3)} ton</td>
                          <td className={num}>
                            <span className="block text-xs text-neutral-500">
                              {t.payModeLabel}
                              {t.payNominal > 0
                                ? ` · ${formatRupiah(t.payNominal)}`
                                : ""}
                            </span>
                            {formatRupiah(t.gaji)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
