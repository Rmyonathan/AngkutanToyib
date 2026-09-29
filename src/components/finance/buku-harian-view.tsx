import {
  FinanceKpiStrip,
  FinancePageHeader,
  Kpi,
} from "@/components/finance/finance-shared";
import { formatNumber, formatRupiah } from "@/lib/utils";
import type { FinancialHppData } from "@/lib/finance/get-financial-hpp";

export function BukuHarianView({ data }: { data: FinancialHppData }) {
  const { summary } = data;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Buku Harian"
        description="Laba-rugi per DO terverifikasi — pendapatan (tonase × tarif) dikurangi biaya aktual DO: uang jalan, solar, biaya lain dan gaji supir."
        periodLabel={data.periodLabel}
      />

      <FinanceKpiStrip summary={summary} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi title="Biaya Solar" value={formatRupiah(summary.solarCost)} muted />
        <Kpi
          title="Biaya Driver"
          value={formatRupiah(summary.driverCost)}
          muted
        />
        <Kpi
          title="Uang Jalan & Biaya Lain"
          value={formatRupiah(summary.otherHpp)}
          sub="Termasuk breakdown & jurnal kas keluar"
          muted
        />
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Biaya per DO
          </h2>
          <p className="text-xs text-neutral-400">
            Otomatis dari DO terverifikasi (tonase × tarif). Pendapatan diakui walau customer belum bayar — lihat Piutang.
          </p>
        </div>
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-100 uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Rit</th>
              <th className="px-3 py-2">Ton</th>
              <th className="px-3 py-2">Revenue</th>
              <th className="px-3 py-2">Uang Jalan</th>
              <th className="px-3 py-2">Solar</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Biaya Lain</th>
              <th className="px-3 py-2">Total HPP</th>
              <th className="px-3 py-2">Profit</th>
              <th className="px-3 py-2">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-3 py-10 text-center text-neutral-400"
                >
                  Tidak ada transaksi operasi.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 font-medium">{r.unitNumber}</td>
                  <td className="max-w-[120px] truncate px-3 py-2">
                    {r.customerName}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.ritase}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatNumber(r.tonase, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatRupiah(r.revenue)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600">
                    {formatRupiah(r.uangJalan)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600">
                    {formatRupiah(r.solarCost)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600">
                    {formatRupiah(r.driverCost)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600">
                    {formatRupiah(r.otherOpsCost)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatRupiah(r.totalHpp)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatRupiah(r.grossProfit)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatNumber(r.marginPercent, 1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
