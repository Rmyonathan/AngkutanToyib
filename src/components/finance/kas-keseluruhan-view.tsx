import Link from "next/link";
import { HppJournalPanel } from "@/components/finance/hpp-journal-panel";
import {
  FinancePageHeader,
  Kpi,
} from "@/components/finance/finance-shared";
import { formatRupiah } from "@/lib/utils";
import type { FinancialHppData } from "@/lib/finance/get-financial-hpp";
import type { ReceivablesSummary } from "@/lib/finance/receivables";

export function KasKeseluruhanView({
  data,
  receivables,
  canWrite,
}: {
  data: FinancialHppData;
  receivables: ReceivablesSummary;
  canWrite: boolean;
}) {
  const { summary } = data;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Kas Keseluruhan"
        description="Basis kas: hanya uang yang benar-benar masuk (pembayaran customer) dan keluar (uang jalan, solar, biaya lain, breakdown, jurnal)."
        periodLabel={data.periodLabel}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Kas Masuk"
          value={formatRupiah(summary.kasIn)}
          sub={`Pembayaran ${formatRupiah(summary.paymentsIn)} + Jurnal ${formatRupiah(summary.journalIn)}`}
        />
        <Kpi
          title="Kas Keluar"
          value={formatRupiah(summary.kasOut)}
          sub={`Uang jalan ${formatRupiah(summary.uangJalanOut)} · Solar/biaya ${formatRupiah(summary.opsCostOut)} · Breakdown ${formatRupiah(summary.breakdownMaintenance)} · Jurnal ${formatRupiah(summary.journalOut)}`}
        />
        <Kpi
          title="Net Kas"
          value={formatRupiah(summary.netKas)}
          sub="Masuk − Keluar (bulan ini)"
        />
        <Kpi
          title="Pendapatan Diakui"
          value={formatRupiah(summary.opsRevenue)}
          muted
          sub="DO terverifikasi bulan ini (belum tentu sudah dibayar)"
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Piutang (uang yang belum masuk)</h2>
            <p className="text-xs text-neutral-500">
              Semua periode. Masuk ke Kas saat pembayaran dicatat di Penagihan &amp; Piutang.
            </p>
          </div>
          <Link
            href="/finance/piutang"
            className="text-sm font-medium underline-offset-2 hover:underline"
          >
            Buka Penagihan &amp; Piutang →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="Total Piutang"
            value={formatRupiah(receivables.totalReceivable)}
          />
          <Kpi
            title="Belum Ditagih"
            value={formatRupiah(receivables.unbilledAmount)}
            muted
            sub={`${receivables.unbilledCount} DO verified tanpa invoice`}
          />
          <Kpi
            title="Invoice Belum Lunas"
            value={formatRupiah(receivables.outstandingAmount)}
            muted
            sub={`${receivables.openInvoiceCount} invoice`}
          />
          <Kpi
            title="Lewat Jatuh Tempo"
            value={formatRupiah(receivables.overdueAmount)}
            sub={`${receivables.overdueCount} invoice`}
          />
        </div>
        {summary.paymentsWithholding > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            PPh 23 dipotong customer bulan ini:{" "}
            {formatRupiah(summary.paymentsWithholding)} — bukan kas, simpan bukti potong untuk kredit pajak.
          </p>
        )}
      </section>

      <HppJournalPanel
        journals={data.journals}
        units={data.units}
        canWrite={canWrite}
      />
    </div>
  );
}
