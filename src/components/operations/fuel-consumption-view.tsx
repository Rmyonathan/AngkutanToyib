"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type {
  FuelConsumptionData,
  FuelStatus,
  FuelUnitRow,
} from "@/lib/operations/fuel-consumption";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import { addMonths, monthEnd, monthStart } from "@/lib/dates";
import { formatNumber, formatRupiah } from "@/lib/utils";

const STATUS: Record<FuelStatus, { label: string; cls: string; hint: string }> = {
  BOROS: {
    label: "Boros",
    cls: "bg-neutral-900 text-white",
    hint: "L/km di atas rata-rata armada — cek kebocoran, kondisi mesin, rute, atau pengisian yang tidak wajar",
  },
  NORMAL: { label: "Normal", cls: "bg-neutral-100 text-neutral-700", hint: "Dalam batas wajar" },
  HEMAT: {
    label: "Hemat",
    cls: "border border-neutral-300 text-neutral-700",
    hint: "Jauh di bawah rata-rata — bagus, atau ada nota solar yang belum diupload / KM terlalu besar",
  },
  DATA_KURANG: {
    label: "Data kurang",
    cls: "border border-dashed border-neutral-300 text-neutral-400",
    hint: "Belum ada liter solar atau KM hauling di periode ini",
  },
};

export function FuelConsumptionView({
  data,
  today,
}: {
  data: FuelConsumptionData;
  today: string;
}) {
  const { fleet } = data;
  const lastMonth = addMonths(monthStart(today), -1);
  const href = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams({
      from: data.from,
      to: data.to,
      threshold: String(data.thresholdPercent),
      ...(data.unitId ? { unitId: data.unitId } : {}),
    });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    return `/operations/solar?${sp.toString()}`;
  };
  const maxLpk = Math.max(fleet.litersPerKm, ...data.units.map((u) => u.litersPerKm), 0.0001);

  function exportCsv() {
    const csv = toCsv(data.units, [
      { header: "Unit", value: (r) => r.unitNumber },
      { header: "Merk", value: (r) => r.brandType },
      { header: "Solar (L)", value: (r) => round(r.liters, 1) },
      { header: "Biaya Solar", value: (r) => Math.round(r.solarCost) },
      { header: "Rp/L", value: (r) => Math.round(r.pricePerLiter) },
      { header: "KM", value: (r) => round(r.km, 1) },
      { header: "Ritase", value: (r) => r.ritase },
      { header: "Tonase", value: (r) => round(r.tonase, 2) },
      { header: "L/km", value: (r) => round(r.litersPerKm, 3) },
      { header: "km/L", value: (r) => round(r.kmPerLiter, 2) },
      { header: "L/rit", value: (r) => round(r.litersPerRit, 1) },
      { header: "Solar Rp/ton", value: (r) => Math.round(r.fuelCostPerTon) },
      { header: "Selisih vs armada (%)", value: (r) => (r.deviationPercent == null ? "" : round(r.deviationPercent, 1)) },
      { header: "Status", value: (r) => STATUS[r.status].label },
    ]);
    downloadCsv(`konsumsi-solar_${data.from}_${data.to}`, csv);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Konsumsi Solar per Unit</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            Liter & rupiah dari nota solar yang diverifikasi, KM dari KM hauling saat verifikasi timbangan,
            ritase & tonase dari DO. Unit dengan L/km jauh di atas rata-rata armada ditandai{" "}
            <b>Boros</b>.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={data.units.length === 0}>
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
          <Input type="date" name="from" defaultValue={data.from} />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input type="date" name="to" defaultValue={data.to} />
        </div>
        <div>
          <Label>Unit</Label>
          <Select name="unitId" defaultValue={data.unitId ?? ""}>
            <option value="">Semua unit</option>
            {data.unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Batas boros (% di atas rata-rata)</Label>
          <Input type="number" name="threshold" min={5} max={100} defaultValue={data.thresholdPercent} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Tampilkan
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs sm:col-span-full">
          <span className="text-neutral-400">Cepat:</span>
          <Link className="font-medium hover:underline" href={href({ from: monthStart(today), to: today })}>
            Bulan ini
          </Link>
          <Link className="font-medium hover:underline" href={href({ from: lastMonth, to: monthEnd(lastMonth) })}>
            Bulan lalu
          </Link>
          {data.unitId && (
            <Link className="font-medium hover:underline" href={href({ unitId: null })}>
              ← Semua unit
            </Link>
          )}
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat title="Total Solar" value={`${formatNumber(fleet.liters, 0)} L`} sub={formatRupiah(fleet.solarCost)} />
        <Stat title="Harga rata-rata" value={`${formatRupiah(fleet.pricePerLiter)}/L`} sub="dari nota berliter" />
        <Stat
          title="Rata-rata armada"
          value={`${formatNumber(fleet.litersPerKm, 3)} L/km`}
          sub={`${formatNumber(fleet.kmPerLiter, 2)} km/L · ${formatNumber(fleet.km, 0)} km`}
        />
        <Stat
          title="Solar per ton"
          value={formatRupiah(fleet.fuelCostPerTon)}
          sub={`${formatNumber(fleet.tonase, 1)} ton · ${fleet.ritase} rit`}
        />
        <Stat
          title="Unit boros"
          value={String(data.units.filter((u) => u.status === "BOROS").length)}
          sub={`> ${data.thresholdPercent}% di atas rata-rata`}
        />
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Ringkasan per Unit</h2>
          <p className="text-xs text-neutral-400">Klik nomor unit untuk melihat rincian harian.</p>
        </div>
        <table className="w-full min-w-[1150px] text-sm">
          <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Solar</th>
              <th className="px-3 py-2 text-right">Rp/L</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">KM</th>
              <th className="px-3 py-2 text-right">Rit</th>
              <th className="px-3 py-2 text-right">Tonase</th>
              <th className="px-3 py-2">L/km vs armada</th>
              <th className="px-3 py-2 text-right">km/L</th>
              <th className="px-3 py-2 text-right">L/rit</th>
              <th className="px-3 py-2 text-right">Solar/ton</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.units.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-neutral-400">
                  Belum ada nota solar terverifikasi atau DO di periode ini.
                </td>
              </tr>
            ) : (
              data.units.map((u) => (
                <UnitRow key={u.unitId} u={u} maxLpk={maxLpk} fleetLpk={fleet.litersPerKm} href={href({ unitId: u.unitId })} />
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold">
            Rincian Harian{data.unitId ? ` — ${data.units[0]?.unitNumber ?? ""}` : ""}
          </h2>
          <p className="text-xs text-neutral-400">
            Unit → tanggal → liter → harga/liter → total → KM → ritase → tonase. Isi solar tidak selalu
            dipakai di hari yang sama, jadi L/km harian bisa naik-turun; lihat total periode untuk penilaian.
          </p>
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Liter</th>
              <th className="px-3 py-2 text-right">Rp/L</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">KM</th>
              <th className="px-3 py-2 text-right">Rit</th>
              <th className="px-3 py-2 text-right">Tonase</th>
              <th className="px-3 py-2 text-right">L/km</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              data.daily.map((d) => (
                <tr key={`${d.unitNumber}-${d.date}`} className="border-b border-neutral-50">
                  <td className="whitespace-nowrap px-3 py-2">{d.date}</td>
                  <td className="px-3 py-2 font-medium">{d.unitNumber}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.liters > 0 ? formatNumber(d.liters, 1) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.pricePerLiter > 0 ? formatRupiah(d.pricePerLiter) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.solarCost > 0 ? formatRupiah(d.solarCost) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.km > 0 ? formatNumber(d.km, 0) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.ritase || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.tonase > 0 ? formatNumber(d.tonase, 1) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.litersPerKm > 0 ? formatNumber(d.litersPerKm, 3) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-neutral-500">
        Agar akurat: isi <b>liter</b> saat verifikasi nota solar dan <b>KM hauling</b> saat verifikasi
        timbangan. Kolom Status menandai unit yang datanya belum lengkap.
      </p>
    </div>
  );
}

function UnitRow({
  u,
  maxLpk,
  fleetLpk,
  href,
}: {
  u: FuelUnitRow;
  maxLpk: number;
  fleetLpk: number;
  href: string;
}) {
  const st = STATUS[u.status];
  const warnings = [
    u.notesWithoutLiters > 0 ? `${u.notesWithoutLiters} nota tanpa liter` : null,
    u.tripsWithoutKm > 0 ? `${u.tripsWithoutKm} trip tanpa KM` : null,
  ].filter(Boolean);
  return (
    <tr className="border-b border-neutral-50 hover:bg-neutral-50">
      <td className="px-3 py-2">
        <Link href={href} className="font-medium underline underline-offset-2">
          {u.unitNumber}
        </Link>
        <span className="block text-[11px] text-neutral-400">{u.brandType}</span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.liters, 0)} L</td>
      <td className="px-3 py-2 text-right tabular-nums">{u.pricePerLiter > 0 ? formatRupiah(u.pricePerLiter) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(u.solarCost)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.km, 0)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{u.ritase}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(u.tonase, 1)}</td>
      <td className="w-56 px-3 py-2">
        {u.litersPerKm > 0 ? (
          <div>
            <div className="flex items-baseline justify-between text-xs tabular-nums">
              <span className="font-semibold">{formatNumber(u.litersPerKm, 3)}</span>
              {u.deviationPercent != null && (
                <span className={u.deviationPercent > 0 ? "font-semibold" : "text-neutral-500"}>
                  {u.deviationPercent > 0 ? "+" : ""}
                  {formatNumber(u.deviationPercent, 0)}%
                </span>
              )}
            </div>
            <div className="relative mt-1 h-1.5 rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-900"
                style={{ width: `${Math.min(100, (u.litersPerKm / maxLpk) * 100)}%` }}
              />
              {fleetLpk > 0 && (
                <div
                  className="absolute -top-1 h-3.5 w-px bg-red-500"
                  style={{ left: `${Math.min(100, (fleetLpk / maxLpk) * 100)}%` }}
                  title="Rata-rata armada"
                />
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{u.kmPerLiter > 0 ? formatNumber(u.kmPerLiter, 2) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{u.litersPerRit > 0 ? formatNumber(u.litersPerRit, 1) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{u.fuelCostPerTon > 0 ? formatRupiah(u.fuelCostPerTon) : "—"}</td>
      <td className="px-3 py-2">
        <span title={st.hint} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>
          {st.label}
        </span>
        {warnings.length > 0 && (
          <span className="mt-0.5 block text-[10px] text-neutral-400">{warnings.join(" · ")}</span>
        )}
      </td>
    </tr>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
