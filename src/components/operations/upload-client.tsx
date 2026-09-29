"use client";

import { useMemo, useState, useTransition } from "react";
import { FieldSubmissionStatus } from "@prisma/client";
import { createFieldUpload } from "@/actions/field-upload";
import { PhotoUploadField } from "@/components/operations/photo-upload-field";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { todayDateOnly } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type UploadTripOption = { id: string; name: string; customerName: string };

type RecentUpload = {
  id: string;
  date: string;
  tripName: string;
  customerName: string;
  status: FieldSubmissionStatus;
  rejectReason: string | null;
  hasSolar: boolean;
  doNumber: string | null;
  netto: number | null;
};

const STATUS_LABEL: Record<FieldSubmissionStatus, string> = {
  PENDING: "Menunggu verifikasi",
  PROCESSED: "Sudah jadi DO",
  REJECTED: "Ditolak",
};

export function UploadClient({
  identity,
  onBehalf,
  trips,
  drivers,
  units,
  recent,
  useCloudUpload = false,
}: {
  identity: { driverName: string; unitNumber: string | null } | null;
  onBehalf: boolean;
  trips: UploadTripOption[];
  drivers: { id: string; name: string; unitId: string | null }[];
  units: { id: string; unitNumber: string }[];
  recent: RecentUpload[];
  useCloudUpload?: boolean;
}) {
  const [tripId, setTripId] = useState("");
  const [suratJalan, setSuratJalan] = useState<string | null>(null);
  const [withSolar, setWithSolar] = useState(false);
  const [solar, setSolar] = useState<string | null>(null);
  const [withOther, setWithOther] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [driverId, setDriverId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [date, setDate] = useState(todayDateOnly());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tripsByCustomer = useMemo(() => {
    const map = new Map<string, UploadTripOption[]>();
    for (const t of trips) {
      const list = map.get(t.customerName) ?? [];
      list.push(t);
      map.set(t.customerName, list);
    }
    return Array.from(map.entries());
  }, [trips]);

  const blocked = identity
    ? !identity.unitNumber
    : !onBehalf;

  function resetForm() {
    setTripId("");
    setSuratJalan(null);
    setWithSolar(false);
    setSolar(null);
    setWithOther(false);
    setOther(null);
    setNotes("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!tripId) return setError("Pilih trip dulu");
    if (!suratJalan) return setError("Foto Surat Jalan wajib");
    if (withSolar && !solar) return setError("Foto nota solar belum diupload");
    if (withOther && !other) return setError("Foto nota biaya lain belum diupload");
    if (onBehalf && !driverId) return setError("Pilih driver");

    startTransition(async () => {
      const res = await createFieldUpload({
        customerTripId: tripId,
        suratJalanPhoto: suratJalan,
        solarPhoto: withSolar ? solar : null,
        otherPhoto: withOther ? other : null,
        notes: notes || null,
        driverId: onBehalf ? driverId : null,
        unitId: onBehalf ? unitId || null : null,
        date: onBehalf ? date : null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOk("Dokumen terkirim — menunggu Admin verifikasi.");
      resetForm();
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-1 pb-10">
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-neutral-900">Upload Dokumen</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pilih trip, foto Surat Jalan, lalu nota solar kalau isi solar.
        </p>
      </header>

      {identity ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">
            Login sebagai
          </p>
          <p className="font-semibold text-neutral-900">{identity.driverName}</p>
          <p className="text-neutral-600">
            Mobil: {identity.unitNumber ?? "— belum di-assign —"}
          </p>
          {!identity.unitNumber && (
            <p className="mt-2 text-xs font-medium text-neutral-900">
              Akun Anda belum di-assign ke unit. Hubungi admin sebelum upload.
            </p>
          )}
        </div>
      ) : !onBehalf ? (
        <p className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm">
          Akun Anda belum terhubung ke data driver. Minta admin menghubungkan
          akun ini di Master Driver.
        </p>
      ) : null}

      {ok && (
        <p className="rounded-xl border border-neutral-900 bg-white px-4 py-3 text-sm font-medium">
          {ok}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        {onBehalf && (
          <div className="grid gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4">
            <p className="text-xs text-neutral-500">
              Upload atas nama supir (akun admin tidak terhubung ke driver).
            </p>
            <div>
              <Label>Driver</Label>
              <Select
                required
                value={driverId}
                onChange={(e) => {
                  const d = drivers.find((x) => x.id === e.target.value);
                  setDriverId(e.target.value);
                  setUnitId(d?.unitId ?? "");
                }}
              >
                <option value="">— Pilih driver —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Select
                  required
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">— Pilih unit —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <Label>Pilih Trip</Label>
          <Select
            required
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            className="h-12 text-base"
          >
            <option value="">
              {trips.length === 0 ? "Belum ada trip — hubungi admin" : "— Pilih trip —"}
            </option>
            {tripsByCustomer.map(([customer, list]) => (
              <optgroup key={customer} label={customer}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <PhotoUploadField
          label="Foto Surat Jalan / Tiket Timbangan"
          hint="Wajib"
          value={suratJalan}
          onChange={setSuratJalan}
          useCloudUpload={useCloudUpload}
        />

        <Toggle
          checked={withSolar}
          onChange={setWithSolar}
          label="Isi solar di trip ini"
          hint="Kalau tidak isi solar, biarkan mati"
        />
        {withSolar && (
          <PhotoUploadField
            label="Foto Nota Solar"
            value={solar}
            onChange={setSolar}
            useCloudUpload={useCloudUpload}
          />
        )}

        <Toggle
          checked={withOther}
          onChange={setWithOther}
          label="Ada biaya lain (tol, parkir, dll.)"
        />
        {withOther && (
          <PhotoUploadField
            label="Foto Nota Biaya Lain"
            value={other}
            onChange={setOther}
            useCloudUpload={useCloudUpload}
          />
        )}

        <div>
          <Label>Catatan (opsional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm font-medium text-neutral-900">{error}</p>}
        <Button
          type="submit"
          disabled={pending || blocked || trips.length === 0}
          className="h-12 w-full text-base"
        >
          {pending ? "Mengirim…" : "Kirim Dokumen"}
        </Button>
      </form>

      {recent.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold">
            Upload Terakhir
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900">{r.tripName}</p>
                    <p className="text-xs text-neutral-500">
                      {r.date} · {r.customerName}
                      {r.hasSolar ? " · + solar" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase",
                      r.status === "PROCESSED"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300"
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.status === "PROCESSED" && r.doNumber && (
                  <p className="mt-1 text-xs text-neutral-600">
                    {r.doNumber}
                    {r.netto != null ? ` · ${formatNumber(r.netto, 2)} ton` : ""}
                  </p>
                )}
                {r.status === "REJECTED" && r.rejectReason && (
                  <p className="mt-1 text-xs text-neutral-900">
                    Alasan: {r.rejectReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-neutral-200 bg-white px-4 py-3">
      <span>
        <span className="block text-base font-semibold text-neutral-900">{label}</span>
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 accent-neutral-900"
      />
    </label>
  );
}
