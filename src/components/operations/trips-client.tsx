"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  TripEditDialog,
  type TripEditData,
  type TripEditOptions,
} from "@/components/operations/trip-edit-dialog";
import {
  DO_INVOICEABLE_STATUSES,
  DO_STATUS_LABEL,
  isDoEditable,
} from "@/lib/operations/do-status";
import { formatNumber, formatRupiah } from "@/lib/utils";

export type TripRow = TripEditData & {
  unitNumber: string;
  driverName: string;
  customerName: string | null;
  tripName: string | null;
};

export function TripsClient({
  trips,
  options,
  canWrite,
  canVerify,
  pendingUploads,
}: {
  trips: TripRow[];
  options: TripEditOptions | null;
  canWrite: boolean;
  canVerify: boolean;
  pendingUploads: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TripRow | null>(null);

  const stats = useMemo(() => {
    let tonase = 0;
    let revenue = 0;
    let unbilled = 0;
    for (const t of trips) {
      tonase += t.netto ?? 0;
      revenue += (t.netto ?? 0) * t.ratePerTon;
      if (DO_INVOICEABLE_STATUSES.includes(t.status)) unbilled += 1;
    }
    return { tonase, revenue, unbilled };
  }, [trips]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Data DO</h1>
          <p className="mt-1 text-sm text-neutral-500">
            DO dibuat otomatis saat Admin memverifikasi upload supir. Klik DO
            untuk lihat dokumen, ongkosan &amp; untung.
          </p>
        </div>
        {canVerify && (
          <Link
            href="/operations/verify"
            className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Verifikasi Upload ({pendingUploads})
          </Link>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Kpi title="Menunggu verifikasi" value={String(pendingUploads)} />
        <Kpi title="Total DO" value={String(trips.length)} />
        <Kpi title="Belum ditagih" value={String(stats.unbilled)} />
        <Kpi title="Total tonase" value={`${formatNumber(stats.tonase, 2)} t`} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">No. DO</th>
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Driver</th>
              <th className="px-4 py-2">Customer · Trip</th>
              <th className="px-4 py-2">Tiket</th>
              <th className="px-4 py-2 text-right">Tonase</th>
              <th className="px-4 py-2 text-right">Rate/Ton</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2">Status</th>
              {canWrite && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 11 : 10}
                  className="px-4 py-10 text-center text-neutral-400"
                >
                  Belum ada DO. DO muncul setelah upload supir diverifikasi.
                </td>
              </tr>
            ) : (
              trips.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-neutral-50 hover:bg-neutral-50"
                  onClick={() => router.push(`/operations/trips/${t.id}`)}
                >
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={`/operations/trips/${t.id}`}
                      className="underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.internalTripId}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{t.date}</td>
                  <td className="px-4 py-2.5">{t.unitNumber}</td>
                  <td className="px-4 py-2.5">{t.driverName}</td>
                  <td className="px-4 py-2.5">
                    {t.customerName ?? "—"}
                    {t.tripName && (
                      <span className="block text-xs text-neutral-500">
                        {t.tripName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {t.ticketNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {t.netto != null ? `${formatNumber(t.netto, 2)} t` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatRupiah(t.ratePerTon)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatRupiah((t.netto ?? 0) * t.ratePerTon)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {DO_STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-2 py-2.5">
                      {isDoEditable(t.status) && (
                        <button
                          type="button"
                          title="Edit DO"
                          aria-label={`Edit ${t.internalTripId}`}
                          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(t);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {trips.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 font-semibold">
                <td className="px-4 py-2.5" colSpan={6}>
                  Total
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatNumber(stats.tonase, 2)} t
                </td>
                <td />
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatRupiah(stats.revenue)}
                </td>
                <td colSpan={canWrite ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      {options && (
        <TripEditDialog
          trip={editing}
          options={options}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
