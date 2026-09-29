import { formatNumber, formatRupiah } from "@/lib/utils";

export type UnitPerformanceRow = {
  unitNumber: string;
  /** Days with ≥ 1 verified DO in the range */
  hariJalan: number;
  ritase: number;
  tonase: number;
  km: number;
  solarLiters: number;
  tonPerKm: number;
  fuelCostPerTon: number;
  revenue: number;
  hpp: number;
  hppPerTon: number;
  profitPerUnit: number;
};

type Props = {
  rows: UnitPerformanceRow[];
  showDays?: boolean;
};

export function UnitPerformanceTable({ rows, showDays = false }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2 font-medium">Unit</th>
            {showDays && <th className="px-3 py-2 text-right font-medium">Hari jalan</th>}
            <th className="px-3 py-2 text-right font-medium">Rit</th>
            <th className="px-3 py-2 text-right font-medium">Tonase</th>
            <th className="px-3 py-2 text-right font-medium">KM</th>
            <th className="px-3 py-2 text-right font-medium">Ton/km</th>
            <th className="px-3 py-2 text-right font-medium">Solar</th>
            <th className="px-3 py-2 text-right font-medium">Solar/Ton</th>
            <th className="px-3 py-2 text-right font-medium">Revenue</th>
            <th className="px-3 py-2 text-right font-medium">HPP</th>
            <th className="px-3 py-2 text-right font-medium">HPP/Ton</th>
            <th className="px-3 py-2 text-right font-medium">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showDays ? 12 : 11} className="px-3 py-8 text-center text-neutral-400">
                Belum ada DO terverifikasi di periode ini.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.unitNumber}
                className="border-b border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2.5 font-medium text-neutral-900">
                  {row.unitNumber}
                </td>
                {showDays && (
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.hariJalan}</td>
                )}
                <td className="px-3 py-2.5 text-right tabular-nums">{row.ritase}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(row.tonase, 2)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.km > 0 ? formatNumber(row.km, 0) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.tonPerKm > 0 ? formatNumber(row.tonPerKm, 2) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.solarLiters > 0 ? `${formatNumber(row.solarLiters, 0)} L` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatRupiah(row.fuelCostPerTon)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-900">
                  {formatRupiah(row.revenue)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                  {formatRupiah(row.hpp)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                  {formatRupiah(row.hppPerTon)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-neutral-900">
                  {formatRupiah(row.profitPerUnit)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
