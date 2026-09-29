import Link from "next/link";
import { JournalEntryType } from "@prisma/client";
import { FinancePageHeader, Kpi } from "@/components/finance/finance-shared";
import { formatNumber, formatRupiah } from "@/lib/utils";
import type { UnitProfitDetail } from "@/lib/finance/get-financial-hpp";

export function UnitProfitDetailView({ data }: { data: UnitProfitDetail }) {
  const { unit } = data;
  const costTotal = data.costLines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/finance/profitabilitas"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Profitabilitas
        </Link>
      </div>

      <FinancePageHeader
        title={unit.unitNumber}
        description="Rincian revenue, HPP, dan aliran kas yang di-assign ke unit ini."
        periodLabel={data.periodLabel}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Tonase" value={formatNumber(unit.tonase, 1)} />
        <Kpi title="Revenue" value={formatRupiah(unit.revenue)} />
        <Kpi title="Total HPP" value={formatRupiah(unit.totalHpp)} />
        <Kpi
          title="Profit"
          value={formatRupiah(unit.grossProfit)}
          sub={`Margin ${formatNumber(unit.marginPercent, 1)}%`}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Ke mana uang pergi (HPP)
          </h2>
          <p className="text-xs text-neutral-400">
            Komponen biaya yang membentuk total HPP unit ini
          </p>
        </div>
        {data.costLines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-400">
            Belum ada komponen HPP untuk unit ini.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-50">
            {data.costLines.map((line) => {
              const pct =
                unit.totalHpp > 0 ? (line.amount / unit.totalHpp) * 100 : 0;
              return (
                <li
                  key={line.label}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {line.label}
                    </p>
                    {line.note && (
                      <p className="text-xs text-neutral-400">{line.note}</p>
                    )}
                    <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-neutral-800"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      {formatRupiah(line.amount)}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-400">
                      {formatNumber(pct, 1)}% HPP
                    </p>
                  </div>
                </li>
              );
            })}
            <li className="flex justify-between bg-neutral-50 px-4 py-3 text-sm font-semibold">
              <span>Total komponen</span>
              <span className="tabular-nums">{formatRupiah(costTotal)}</span>
            </li>
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Delivery Order
          </h2>
          <p className="text-xs text-neutral-400">
            Trip selesai bulan ini — klik untuk detail trip
          </p>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Supir</th>
              <th className="px-4 py-2">Tonase</th>
              <th className="px-4 py-2">Revenue</th>
              <th className="px-4 py-2">HPP</th>
              <th className="px-4 py-2">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.trips.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-neutral-400"
                >
                  Belum ada DO selesai untuk unit ini bulan ini.
                </td>
              </tr>
            ) : (
              data.trips.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/operations/trips/${t.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {t.date}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{t.customerName}</td>
                  <td className="px-4 py-2.5">{t.driverName}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {formatNumber(t.tonase, 1)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {formatRupiah(t.revenue)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                    {formatRupiah(t.totalHpp)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">
                    {formatRupiah(t.grossProfit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Pergerakan kas assign unit
          </h2>
          <p className="text-xs text-neutral-400">
            Pemasukan DO, biaya breakdown, dan jurnal manual
          </p>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Tipe</th>
              <th className="px-4 py-2">Sumber</th>
              <th className="px-4 py-2">Keterangan</th>
              <th className="px-4 py-2">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-neutral-400"
                >
                  Belum ada pergerakan kas untuk unit ini.
                </td>
              </tr>
            ) : (
              data.movements.map((m) => {
                const isIn = m.entryType === JournalEntryType.CASH_IN;
                return (
                  <tr key={m.id} className="border-b border-neutral-50">
                    <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                      {m.date}
                    </td>
                    <td className="px-4 py-2.5">
                      {isIn ? "Masuk" : "Keluar"}
                    </td>
                    <td className="px-4 py-2.5 text-xs uppercase text-neutral-500">
                      {m.source}
                    </td>
                    <td className="px-4 py-2.5">
                      <p>{m.description}</p>
                      {m.notes && (
                        <p className="text-xs text-neutral-400">{m.notes}</p>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 tabular-nums font-medium ${
                        isIn ? "text-neutral-900" : "text-neutral-600"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {formatRupiah(m.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
