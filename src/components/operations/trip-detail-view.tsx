import Link from "next/link";
import { formatNumber, formatRupiah } from "@/lib/utils";

export type TripDetailData = {
  id: string;
  internalTripId: string;
  date: string;
  status: string;
  statusLabel: string;
  unitNumber: string;
  driverName: string;
  customerName: string | null;
  tripName: string | null;
  ticketNumber: string | null;
  netto: number | null;
  ratePerTon: number;
  uangJalan: number;
  kmHauling: number | null;
  notes: string | null;
  /** Upload supir yang jadi sumber DO ini */
  upload: {
    date: string;
    uploadedBy: string;
    suratJalanPhoto: string;
    solarPhoto: string | null;
    otherPhoto: string | null;
    notes: string | null;
  } | null;
  suratJalanPhoto: string | null;
  costs: {
    id: string;
    costType: string;
    amount: number;
    volume: number | null;
    pricePerLiter: number | null;
    description: string;
  }[];
};

const COST_LABEL: Record<string, string> = {
  SOLAR: "Solar",
  MAINTENANCE: "Maintenance",
  LAINNYA: "Biaya Lain",
};

export function TripDetailView({
  trip,
  actions,
}: {
  trip: TripDetailData;
  actions?: React.ReactNode;
}) {
  const netto = trip.netto ?? 0;
  const rate = trip.ratePerTon;
  const revenue = netto * rate;
  const opsCostTotal = trip.costs.reduce((s, c) => s + c.amount, 0);
  const ongkosan = trip.uangJalan + opsCostTotal;
  const untung = revenue - ongkosan;

  const docs = [
    {
      title: "Surat Jalan",
      url: trip.upload?.suratJalanPhoto ?? trip.suratJalanPhoto,
      meta: trip.ticketNumber ? `Tiket ${trip.ticketNumber}` : undefined,
    },
    { title: "Nota Solar", url: trip.upload?.solarPhoto ?? null },
    { title: "Nota Biaya Lain", url: trip.upload?.otherPhoto ?? null },
  ].filter((d): d is { title: string; url: string; meta?: string } => !!d.url);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/operations/trips"
            className="text-sm font-medium underline underline-offset-2"
          >
            ← Data DO
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">
            {trip.internalTripId}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {trip.date} · {trip.unitNumber} · {trip.driverName}
            {trip.customerName ? ` · ${trip.customerName}` : ""}
            {trip.tripName ? ` · ${trip.tripName}` : ""}
          </p>
          <span className="mt-2 inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {trip.statusLabel}
          </span>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Tonase"
          value={trip.netto != null ? `${formatNumber(trip.netto, 3)} ton` : "—"}
          sub={trip.ticketNumber ? `Tiket ${trip.ticketNumber}` : undefined}
        />
        <Kpi title="Harga / Rate" value={formatRupiah(rate)} sub="per ton" />
        <Kpi title="Revenue" value={formatRupiah(revenue)} sub="Tonase × Rate" />
        <Kpi
          title="Untung"
          value={formatRupiah(untung)}
          sub={`Revenue − Ongkosan ${formatRupiah(ongkosan)}`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Detail DO &amp; Tarif
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Item label="Customer" value={trip.customerName ?? "—"} />
            <Item label="Trip" value={trip.tripName ?? "—"} />
            <Item label="No. Tiket" value={trip.ticketNumber ?? "—"} />
            <Item label="Rate / Ton" value={formatRupiah(trip.ratePerTon)} />
            <Item
              label="KM Hauling"
              value={
                trip.kmHauling != null ? `${formatNumber(trip.kmHauling, 1)} km` : "—"
              }
            />
            <Item
              label="Upload oleh"
              value={
                trip.upload
                  ? `${trip.upload.uploadedBy} · ${trip.upload.date}`
                  : "—"
              }
            />
            <Item label="Catatan" value={trip.notes ?? "—"} />
          </dl>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Ongkosan</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between border-b border-neutral-50 pb-2">
              <span className="text-neutral-600">Uang Jalan</span>
              <span className="font-medium tabular-nums">
                {formatRupiah(trip.uangJalan)}
              </span>
            </li>
            {trip.costs.map((c) => (
              <li
                key={c.id}
                className="flex justify-between border-b border-neutral-50 pb-2"
              >
                <span className="text-neutral-600">
                  {COST_LABEL[c.costType] ?? c.costType}
                  {c.volume != null && (
                    <span className="mt-0.5 block text-xs text-neutral-400">
                      {formatNumber(c.volume, 2)} L
                      {c.pricePerLiter != null
                        ? ` × ${formatRupiah(c.pricePerLiter)}/L`
                        : ""}
                    </span>
                  )}
                  {c.costType !== "SOLAR" && (
                    <span className="mt-0.5 block text-xs text-neutral-400">
                      {c.description}
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {formatRupiah(c.amount)}
                </span>
              </li>
            ))}
            {trip.costs.length === 0 && (
              <li className="text-neutral-400">Tidak ada biaya solar / lain.</li>
            )}
            <li className="flex justify-between pt-1 font-semibold">
              <span>Total Ongkosan</span>
              <span className="tabular-nums">{formatRupiah(ongkosan)}</span>
            </li>
            <li className="flex justify-between font-semibold text-neutral-900">
              <span>Untung</span>
              <span className="tabular-nums">{formatRupiah(untung)}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Foto Dokumen
          </h2>
          {trip.upload?.notes && (
            <p className="text-xs text-neutral-500">
              Catatan supir: {trip.upload.notes}
            </p>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-400">
            Tidak ada foto.
          </p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <DocCard key={d.title} title={d.title} photoUrl={d.url} meta={d.meta} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
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

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function DocCard({
  title,
  photoUrl,
  meta,
}: {
  title: string;
  photoUrl: string;
  meta?: string;
}) {
  return (
    <a
      href={photoUrl}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-xl border border-neutral-200 hover:border-neutral-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt={title}
        className="h-48 w-full bg-neutral-50 object-contain"
      />
      <div className="border-t border-neutral-100 px-3 py-2">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {meta && <p className="mt-0.5 text-xs text-neutral-600">{meta}</p>}
      </div>
    </a>
  );
}
