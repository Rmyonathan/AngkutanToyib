import Link from "next/link";
import { redirect } from "next/navigation";
import { formatNumber, formatRupiah } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueHppProfitChart } from "@/components/dashboard/revenue-hpp-chart";
import { UnitPerformanceTable } from "@/components/dashboard/unit-performance-table";
import { DashboardDateFilter } from "@/components/dashboard/dashboard-date-filter";
import {
  getOwnerDashboardData,
  type DashboardData,
} from "@/lib/dashboard/get-owner-dashboard";
import { requireSession } from "@/lib/auth/session";
import { canViewDashboard } from "@/lib/auth/rbac";
import { monthEnd, monthLabel, monthStart, parseDateOnly, todayDateOnly, tryParseDateOnly } from "@/lib/dates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: { date?: string; from?: string; to?: string; month?: string };
}) {
  const session = await requireSession();
  if (!canViewDashboard(session.user.role)) redirect("/upload");

  const today = todayDateOnly();
  const { from, to } = resolveRange(searchParams, today);

  let data: DashboardData | null = null;
  let loadError: string | null = null;
  try {
    data = await getOwnerDashboardData({ from, to });
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const single = from === to;
  const isToday = single && from === today;
  const periodLabel = describeRange(from, to, today);
  const dayWord = isToday ? "hari ini" : single ? "tgl ini" : "periode ini";

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Owner Dashboard
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            <span className="font-medium text-neutral-800">{periodLabel}</span>
            {isToday ? " (hari ini)" : ""} — produksi & finansial dari DO terverifikasi.
          </p>
        </div>
        <DashboardDateFilter from={from} to={to} />
      </header>

      {loadError || !data ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Dashboard gagal dimuat.</p>
          <p className="mt-1">Coba refresh halaman. Jika tetap gagal, cek koneksi database.</p>
          <p className="mt-2 font-mono text-xs text-red-500">{loadError}</p>
        </div>
      ) : (
        <DashboardBody data={data} dayWord={dayWord} />
      )}
    </div>
  );
}

function resolveRange(
  sp: { date?: string; from?: string; to?: string; month?: string },
  today: string
): { from: string; to: string } {
  const clamp = (d: string) => (d > today ? today : d);
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const start = `${sp.month}-01`;
    return { from: clamp(start), to: clamp(monthEnd(start)) };
  }
  const f = tryParseDateOnly(sp.from) ? sp.from!.slice(0, 10) : null;
  const t = tryParseDateOnly(sp.to) ? sp.to!.slice(0, 10) : null;
  if (f || t) {
    let a = clamp(f ?? t!);
    let b = clamp(t ?? f!);
    if (a > b) [a, b] = [b, a];
    return { from: a, to: b };
  }
  const d = tryParseDateOnly(sp.date) ? clamp(sp.date!.slice(0, 10)) : today;
  return { from: d, to: d };
}

function describeRange(from: string, to: string, today: string): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    parseDateOnly(d).toLocaleDateString("id-ID", { ...opts, timeZone: "UTC" });
  if (from === to) {
    return fmt(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (from === monthStart(from) && (to === monthEnd(from) || (to === today && from.slice(0, 7) === today.slice(0, 7)))) {
    return to === monthEnd(from) ? monthLabel(from) : `${monthLabel(from)} (s/d ${fmt(to, { day: "numeric", month: "short" })})`;
  }
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmt(from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

function Metric({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${muted ? "text-neutral-600" : "text-neutral-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function DashboardBody({ data, dayWord }: { data: DashboardData; dayWord: string }) {
  const { unitStatus, produksi: p, finansialHariIni: f } = data;
  const cob = f.cashOutBreakdown;
  const multi = data.days > 1;

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1.6fr]">
        <KpiCard title="Total Armada">
          <p className="text-3xl font-bold tabular-nums text-neutral-900">
            {unitStatus.total} <span className="text-base font-medium text-neutral-500">unit</span>
          </p>
          <ul className="mt-3 space-y-1 text-sm text-neutral-700">
            <li className="flex justify-between"><span>🟢 Running</span><b className="tabular-nums">{unitStatus.running}</b></li>
            <li className="flex justify-between"><span>🟡 Standby</span><b className="tabular-nums">{unitStatus.standby}</b></li>
            <li className="flex justify-between">
              <Link href="/breakdown" className="hover:underline">🔴 Breakdown</Link>
              <b className="tabular-nums">{unitStatus.breakdown}</b>
            </li>
            <li className="flex justify-between"><span>🔵 Maintenance</span><b className="tabular-nums">{unitStatus.maintenance}</b></li>
          </ul>
        </KpiCard>

        <KpiCard title={`Produksi ${dayWord}`}>
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            <Metric label="Total ritase" value={formatNumber(p.totalRitase, 0)} />
            <Metric label="Total tonase" value={`${formatNumber(p.totalTonase, 1)} t`} />
            <Metric label="Avg tonase/rit" value={`${formatNumber(p.avgTonasePerRit, 1)} t`} />
            <Metric
              label="KM/unit"
              value={p.totalKm > 0 ? formatNumber(p.kmPerUnit, 0) : "—"}
              sub={
                p.totalKm <= 0
                  ? "KM belum diisi"
                  : multi
                    ? `${formatNumber(p.kmPerUnitDay, 0)} km/unit/hari`
                    : `${formatNumber(p.totalKm, 0)} km total`
              }
            />
            <Metric label="Ton/km" value={p.totalKm > 0 ? formatNumber(p.tonPerKm, 2) : "—"} />
            <Metric
              label="Ritase/unit"
              value={formatNumber(p.ritasePerUnit, 1)}
              sub={
                multi
                  ? `${formatNumber(p.ritasePerUnitDay, 1)} rit/unit/hari · ${p.activeUnits} unit`
                  : `${p.activeUnits} unit jalan`
              }
            />
          </div>
        </KpiCard>

        <KpiCard title={`Finansial ${dayWord}`}>
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            <Metric label="Revenue" value={formatRupiah(f.revenue)} />
            <Metric label="HPP" value={formatRupiah(f.hpp)} muted sub={`${formatRupiah(f.hppPerTon)}/ton`} />
            <Metric label="Profit" value={formatRupiah(f.profit)} />
            <Metric label="Profit/ton" value={formatRupiah(f.profitPerTon)} />
            <Metric
              label="Profit/unit"
              value={formatRupiah(f.profitPerUnit)}
              sub={multi ? `${formatRupiah(f.profitPerUnitDay)}/unit/hari` : undefined}
            />
            <Metric
              label="Cash out"
              value={formatRupiah(f.cashOut)}
              muted
              sub={`Kas masuk ${formatRupiah(f.cashIn)}`}
            />
          </div>
          {f.cashOut > 0 && (
            <p className="mt-3 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
              Cash out = uang jalan {formatRupiah(cob.uangJalan)} · solar/biaya {formatRupiah(cob.opsCost)} ·
              breakdown {formatRupiah(cob.breakdown)} · jurnal {formatRupiah(cob.journal)}
            </p>
          )}
        </KpiCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue vs HPP vs Profit</CardTitle>
            <CardDescription>Perbandingan bulanan (6 bulan s/d periode terpilih)</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueHppProfitChart data={data.monthlyChart} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ringkasan Margin</CardTitle>
            <CardDescription className="capitalize">{dayWord}</CardDescription>
          </CardHeader>
          <CardContent>
            <MarginSummary revenue={f.revenue} profit={f.profit} />
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <Link href="/finance/profitabilitas" className="font-medium underline-offset-2 hover:underline">
                Rincian HPP per unit →
              </Link>
              <Link href="/operations/solar" className="font-medium underline-offset-2 hover:underline">
                Konsumsi solar →
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Performa Masing-Masing Unit</CardTitle>
            <CardDescription>
              Rit, tonase, KM, solar, revenue, HPP/ton dan profit per unit ({dayWord})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnitPerformanceTable rows={data.unitPerformance} showDays={multi} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function MarginSummary({ revenue, profit }: { revenue: number; profit: number }) {
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-neutral-500">Gross Margin</p>
        <p className="text-4xl font-bold tabular-nums text-neutral-900">{formatNumber(margin, 1)}%</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all"
          style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }}
        />
      </div>
      <p className="text-xs leading-relaxed text-neutral-500">
        Gross Profit = Revenue − biaya aktual DO (uang jalan, solar, biaya lain, gaji supir).
        Target tipikal hauling batubara 25–40% tergantung jarak dan harga solar.
      </p>
    </div>
  );
}
