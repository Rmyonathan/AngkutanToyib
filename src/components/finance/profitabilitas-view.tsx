import Link from "next/link";
import {
  FinanceKpiStrip,
  FinancePageHeader,
} from "@/components/finance/finance-shared";
import { formatNumber, formatRupiah } from "@/lib/utils";
import type { FinancialHppData } from "@/lib/finance/get-financial-hpp";

export function ProfitabilitasView({ data }: { data: FinancialHppData }) {
  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Profitabilitas per Unit"
        description="Ringkasan revenue, HPP, profit, dan margin dikelompokkan per unit. Klik baris untuk rincian biaya."
        periodLabel={data.periodLabel}
      />

      <FinanceKpiStrip summary={data.summary} />

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Per Unit</h2>
          <p className="text-xs text-neutral-400">
            Termasuk jurnal kas yang di-assign ke unit — klik untuk detail
          </p>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Tonase</th>
              <th className="px-4 py-2">Revenue</th>
              <th className="px-4 py-2">HPP</th>
              <th className="px-4 py-2">Profit</th>
              <th className="px-4 py-2">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.byUnit.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-neutral-400"
                >
                  Belum ada Delivery Order / jurnal dengan unit bulan ini.
                </td>
              </tr>
            ) : (
              data.byUnit.map((u) => (
                <tr
                  key={u.unitNumber}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {u.unitNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="block"
                    >
                      {formatNumber(u.tonase, 1)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="block"
                    >
                      {formatRupiah(u.revenue)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="block"
                    >
                      {formatRupiah(u.totalHpp)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="block"
                    >
                      {formatRupiah(u.grossProfit)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <Link
                      href={`/finance/profitabilitas/${encodeURIComponent(u.unitNumber)}`}
                      className="block"
                    >
                      {formatNumber(u.marginPercent, 1)}%
                    </Link>
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
