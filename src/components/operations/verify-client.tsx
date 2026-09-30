"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  rejectFieldSubmission,
  verifySubmission,
} from "@/actions/verify-submission";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { DecimalField, MoneyField } from "@/components/ui/number-input";
import { cn, formatNumber, formatRupiah } from "@/lib/utils";

export type PendingRow = {
  id: string;
  date: string;
  unitNumber: string;
  driverName: string;
  customerTripId: string;
  suratJalanPhoto: string;
  solarPhoto: string | null;
  otherPhoto: string | null;
  notes: string | null;
};

export type VerifyTripOption = {
  id: string;
  name: string;
  customerName: string;
  /** Tarif trip, atau tarif customer bila trip kosong */
  ratePerTon: number;
  uangJalan: number;
  distanceKm: number | null;
  isActive: boolean;
};

type Form = {
  date: string;
  customerTripId: string;
  ticketNumber: string;
  netto: string;
  kmHauling: string;
  ratePerTon: string;
  uangJalan: string;
  solarLiters: string;
  solarPricePerLiter: string;
  otherAmount: string;
  otherDescription: string;
  notes: string;
};

type PhotoKey = "suratJalan" | "solar" | "other";

export function VerifyInboxClient({
  pending,
  trips,
  defaultSolarPrice,
}: {
  pending: PendingRow[];
  trips: VerifyTripOption[];
  defaultSolarPrice: number;
}) {
  const tripById = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);

  function formFor(row: PendingRow): Form {
    const trip = tripById.get(row.customerTripId);
    return {
      date: row.date,
      customerTripId: row.customerTripId,
      ticketNumber: "",
      netto: "",
      kmHauling: "",
      ratePerTon: trip ? String(trip.ratePerTon) : "",
      uangJalan: trip ? String(trip.uangJalan) : "0",
      solarLiters: "",
      solarPricePerLiter:
        row.solarPhoto && defaultSolarPrice ? String(defaultSolarPrice) : "",
      otherAmount: "",
      otherDescription: "",
      notes: row.notes ?? "",
    };
  }

  const [selectedId, setSelectedId] = useState<string | null>(
    pending[0]?.id ?? null
  );
  const [form, setForm] = useState<Form | null>(
    pending[0] ? formFor(pending[0]) : null
  );
  const [photo, setPhoto] = useState<PhotoKey>("suratJalan");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendingTx, startTransition] = useTransition();
  const router = useRouter();

  const selected = useMemo(
    () => pending.find((p) => p.id === selectedId) ?? null,
    [pending, selectedId]
  );

  const tripsByCustomer = useMemo(() => {
    const map = new Map<string, VerifyTripOption[]>();
    for (const t of trips) {
      if (!t.isActive && t.id !== form?.customerTripId) continue;
      const list = map.get(t.customerName) ?? [];
      list.push(t);
      map.set(t.customerName, list);
    }
    return Array.from(map.entries());
  }, [trips, form?.customerTripId]);

  function selectRow(row: PendingRow) {
    setSelectedId(row.id);
    setForm(formFor(row));
    setPhoto("suratJalan");
    setError(null);
    setOk(null);
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function changeTrip(id: string) {
    const trip = tripById.get(id);
    setForm((f) =>
      f
        ? {
            ...f,
            customerTripId: id,
            ratePerTon: trip ? String(trip.ratePerTon) : f.ratePerTon,
            uangJalan: trip ? String(trip.uangJalan) : f.uangJalan,
          }
        : f
    );
  }

  const num = (v: string | undefined) => (v ? Number(v) || 0 : 0);
  const solarTotal = form
    ? Math.round(num(form.solarLiters) * num(form.solarPricePerLiter))
    : 0;
  const revenue = form ? num(form.netto) * num(form.ratePerTon) : 0;
  const currentTrip = form ? tripById.get(form.customerTripId) : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !form) return;
    setError(null);
    startTransition(async () => {
      const res = await verifySubmission({
        fieldSubmissionId: selected.id,
        date: form.date,
        customerTripId: form.customerTripId,
        ticketNumber: form.ticketNumber,
        netto: form.netto,
        kmHauling: form.kmHauling,
        ratePerTon: form.ratePerTon,
        uangJalan: form.uangJalan || 0,
        solarLiters: form.solarLiters,
        solarPricePerLiter: form.solarLiters ? form.solarPricePerLiter : "",
        otherAmount: form.otherAmount,
        otherDescription: form.otherDescription || null,
        notes: form.notes || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOk(`DO ${res.data.internalTripId} dibuat.`);
      const next = pending.find((p) => p.id !== selected.id);
      if (next) selectRow(next);
      else {
        setSelectedId(null);
        setForm(null);
      }
      router.refresh();
    });
  }

  function onReject() {
    if (!selected) return;
    const reason = window.prompt("Alasan reject (dilihat supir):");
    if (reason === null) return;
    startTransition(async () => {
      const res = await rejectFieldSubmission(selected.id, reason);
      if (!res.success) alert(res.error);
      else {
        setSelectedId(null);
        setForm(null);
        router.refresh();
      }
    });
  }

  const photos: { key: PhotoKey; label: string; url: string | null }[] = selected
    ? [
        { key: "suratJalan", label: "Surat Jalan", url: selected.suratJalanPhoto },
        { key: "solar", label: "Nota Solar", url: selected.solarPhoto },
        { key: "other", label: "Biaya Lain", url: selected.otherPhoto },
      ]
    : [];
  const activePhoto = photos.find((p) => p.key === photo)?.url ?? null;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Verifikasi Dokumen
          </h1>
          <p className="text-sm text-neutral-500">
            Cek foto upload supir, input data dari dokumen → DO otomatis dibuat.
          </p>
        </div>
        <Link
          href="/operations/trips"
          className="text-sm font-medium underline underline-offset-2"
        >
          Data DO →
        </Link>
      </header>

      {ok && (
        <div className="mb-4 rounded-xl border border-neutral-900 bg-white px-4 py-3 text-sm font-medium">
          {ok}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <aside className="rounded-xl border border-neutral-200 bg-white lg:col-span-3">
          <div className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Menunggu ({pending.length})
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {pending.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-neutral-400">
                Antrian kosong.
              </li>
            ) : (
              pending.map((row) => {
                const trip = tripById.get(row.customerTripId);
                const active = selectedId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(row)}
                      className={cn(
                        "w-full border-b border-neutral-100 px-3 py-3 text-left text-sm hover:bg-neutral-50",
                        active && "bg-neutral-900 text-white hover:bg-neutral-800"
                      )}
                    >
                      <p className="font-medium">{trip?.name ?? "—"}</p>
                      <p className={active ? "text-neutral-300" : "text-neutral-500"}>
                        {row.unitNumber} · {row.driverName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        {row.date} · {trip?.customerName ?? ""}
                        {row.solarPhoto ? " · + solar" : ""}
                        {row.otherPhoto ? " · + biaya lain" : ""}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="lg:col-span-5">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-400">
              Pilih upload
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-900 bg-white">
              <div className="flex border-b border-neutral-200">
                {photos.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={!p.url}
                    onClick={() => setPhoto(p.key)}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                      photo === p.key
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-neutral-50",
                      !p.url && "cursor-not-allowed text-neutral-300 hover:bg-white"
                    )}
                  >
                    {p.label}
                    {!p.url && " (—)"}
                  </button>
                ))}
              </div>
              {activePhoto ? (
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setLightbox(activePhoto)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePhoto}
                    alt="Dokumen"
                    className="max-h-[32rem] w-full bg-neutral-50 object-contain"
                  />
                  <span className="block border-t px-3 py-1.5 text-[11px] text-neutral-400">
                    Klik untuk perbesar
                  </span>
                </button>
              ) : (
                <p className="p-10 text-center text-sm text-neutral-400">
                  Tidak ada foto.
                </p>
              )}
              {selected.notes && (
                <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-600">
                  Catatan supir: {selected.notes}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="lg:col-span-4">
          {!selected || !form ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400">
              Form aktif setelah memilih.
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-semibold">Data Dokumen → Buat DO</p>
                <p className="text-xs text-neutral-500">
                  {selected.unitNumber} · {selected.driverName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tanggal DO</Label>
                  <Input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>No. Tiket</Label>
                  <Input
                    required
                    value={form.ticketNumber}
                    onChange={(e) => set("ticketNumber", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Trip</Label>
                <Select
                  required
                  value={form.customerTripId}
                  onChange={(e) => changeTrip(e.target.value)}
                >
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tonase (ton)</Label>
                  <DecimalField
                    required
                    decimals={3}
                    value={form.netto}
                    onChange={(netto) => set("netto", netto)}
                  />
                </div>
                <div>
                  <Label>KM Hauling (opsional)</Label>
                  <DecimalField
                    decimals={1}
                    placeholder={
                      currentTrip?.distanceKm != null
                        ? `jarak trip ${currentTrip.distanceKm} km`
                        : ""
                    }
                    value={form.kmHauling}
                    onChange={(kmHauling) => set("kmHauling", kmHauling)}
                  />
                </div>
                <div>
                  <Label>Tarif / Ton</Label>
                  <MoneyField
                    required
                    value={form.ratePerTon}
                    onChange={(ratePerTon) => set("ratePerTon", ratePerTon)}
                  />
                </div>
                <div>
                  <Label>Uang Jalan</Label>
                  <MoneyField
                    value={form.uangJalan}
                    onChange={(uangJalan) => set("uangJalan", uangJalan)}
                  />
                </div>
              </div>

              <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
                <legend className="px-1 text-xs font-semibold text-neutral-700">
                  Solar {selected.solarPhoto ? "" : "(tidak ada nota — kosongkan)"}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Liter</Label>
                    <DecimalField
                      decimals={2}
                      value={form.solarLiters}
                      onChange={(solarLiters) => set("solarLiters", solarLiters)}
                    />
                  </div>
                  <div>
                    <Label>Harga / Liter</Label>
                    <MoneyField
                      value={form.solarPricePerLiter}
                      onChange={(solarPricePerLiter) =>
                        set("solarPricePerLiter", solarPricePerLiter)
                      }
                    />
                  </div>
                </div>
                <p className="flex justify-between text-xs">
                  <span className="text-neutral-500">Total = liter × harga/liter</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(solarTotal)}
                  </span>
                </p>
              </fieldset>

              {(selected.otherPhoto || form.otherAmount) && (
                <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
                  <legend className="px-1 text-xs font-semibold text-neutral-700">
                    Biaya Lain
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Nominal (Rp)</Label>
                      <MoneyField
                        value={form.otherAmount}
                        onChange={(otherAmount) => set("otherAmount", otherAmount)}
                      />
                    </div>
                    <div>
                      <Label>Keterangan</Label>
                      <Input
                        placeholder="Tol, parkir…"
                        value={form.otherDescription}
                        onChange={(e) => set("otherDescription", e.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>
              )}

              <div>
                <Label>Catatan</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>

              <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs">
                <p className="flex justify-between">
                  <span className="text-neutral-500">Revenue (netto × tarif)</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(revenue)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-neutral-500">Tonase</span>
                  <span className="tabular-nums">
                    {formatNumber(num(form.netto), 3)} ton
                  </span>
                </p>
              </div>

              {error && <p className="text-sm font-medium text-neutral-900">{error}</p>}
              <Button type="submit" disabled={pendingTx} className="w-full">
                {pendingTx ? "Menyimpan…" : "Verifikasi & Buat DO"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pendingTx}
                onClick={onReject}
                className="w-full"
              >
                Reject
              </Button>
            </form>
          )}
        </section>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Preview"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
