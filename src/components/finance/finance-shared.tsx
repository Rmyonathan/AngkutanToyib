import { formatNumber, formatRupiah } from "@/lib/utils";
import type { FinancialHppSummary } from "@/lib/finance/get-financial-hpp";

export function FinancePageHeader({
  title,
  description,
  periodLabel,
}: {
  title: string;
  description: string;
  periodLabel: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
        <p className="mt-1 text-xs text-neutral-400">{periodLabel}</p>
      </div>
    </header>
  );
}

export function FinanceKpiStrip({ summary }: { summary: FinancialHppSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi title="Revenue" value={formatRupiah(summary.revenue)} />
      <Kpi title="Total HPP" value={formatRupiah(summary.totalHpp)} />
      <Kpi title="Gross Profit" value={formatRupiah(summary.grossProfit)} />
      <Kpi
        title="Margin"
        value={`${formatNumber(summary.marginPercent, 1)}%`}
        sub={`Profit/ton ${formatRupiah(summary.profitPerTon)}`}
      />
    </section>
  );
}

export function Kpi({
  title,
  value,
  sub,
  muted,
}: {
  title: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 p-4 ${
        muted ? "bg-neutral-50" : "bg-white"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
