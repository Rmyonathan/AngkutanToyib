"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerInput,
} from "@/actions/masters/customers";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  DecimalField,
  DecimalInput,
  IntegerInput,
  MoneyField,
  MoneyInput,
} from "@/components/ui/number-input";
import { FormDialog } from "@/components/masters/form-dialog";
import { formatNumber, formatRupiah } from "@/lib/utils";

export type CustomerTripRow = {
  id: string;
  name: string;
  distanceKm: number | null;
  ratePerTon: number | null;
  uangJalan: number | null;
  isActive: boolean;
};

type TripForm = {
  key: string;
  id: string | null;
  name: string;
  distanceKm: string;
  ratePerTon: string;
  uangJalan: string;
  isActive: boolean;
};

type CustomerForm = Omit<CustomerInput, "trips"> & {
  customerName: string;
  loadingLocation: string;
  dumpingLocation: string;
  oneWayDistance: number;
  ratePerTon: number;
  targetTonase: number;
  paymentTermDays: number;
  isActive: boolean;
};

const str = (v: number | null) => (v == null ? "" : String(v));
let tripKey = 0;
const newTrip = (): TripForm => ({
  key: `new-${++tripKey}`,
  id: null,
  name: "",
  distanceKm: "",
  ratePerTon: "",
  uangJalan: "",
  isActive: true,
});

export type CustomerRow = {
  id: string;
  customerName: string;
  loadingLocation: string;
  dumpingLocation: string;
  oneWayDistance: number;
  ratePerTon: number;
  targetTonase: number;
  paymentTermDays: number;
  isActive: boolean;
  trips: CustomerTripRow[];
};

const emptyForm = (): CustomerForm => ({
  customerName: "",
  loadingLocation: "",
  dumpingLocation: "",
  oneWayDistance: 0,
  ratePerTon: 0,
  targetTonase: 0,
  paymentTermDays: 30,
  isActive: true,
});

export function CustomersClient({
  customers,
  canWrite,
}: {
  customers: CustomerRow[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm());
  const [trips, setTrips] = useState<TripForm[]>([newTrip()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setTrips([newTrip()]);
    setError(null);
    setOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setEditingId(row.id);
    setForm({
      customerName: row.customerName,
      loadingLocation: row.loadingLocation,
      dumpingLocation: row.dumpingLocation,
      oneWayDistance: row.oneWayDistance,
      ratePerTon: row.ratePerTon,
      targetTonase: row.targetTonase,
      paymentTermDays: row.paymentTermDays,
      isActive: row.isActive,
    });
    setTrips(
      row.trips.length
        ? row.trips.map((t) => ({
            key: t.id,
            id: t.id,
            name: t.name,
            distanceKm: str(t.distanceKm),
            ratePerTon: str(t.ratePerTon),
            uangJalan: str(t.uangJalan),
            isActive: t.isActive,
          }))
        : [newTrip()]
    );
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: CustomerInput = {
      ...form,
      trips: trips.map((t) => ({
        id: t.id,
        name: t.name,
        distanceKm: t.distanceKm,
        ratePerTon: t.ratePerTon,
        uangJalan: t.uangJalan,
        isActive: t.isActive,
      })),
    };
    startTransition(async () => {
      const res = editingId
        ? await updateCustomer(editingId, payload)
        : await createCustomer(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  function onDelete(id: string, label: string) {
    if (!confirm(`Hapus customer ${label}?`)) return;
    startTransition(async () => {
      const res = await deleteCustomer(id);
      if (!res.success) alert(res.error);
    });
  }

  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.customerName.localeCompare(b.customerName)),
    [customers]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Master Customer / Project
          </h1>
          <p className="text-sm text-neutral-500">
            Loading, dumping, tarif/ton, tempo &amp; daftar trip yang dipilih supir saat upload
          </p>
        </div>
        {canWrite && (
          <Button type="button" onClick={openCreate} disabled={pending}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Loading</th>
              <th className="px-3 py-2.5">Dumping</th>
              <th className="px-3 py-2.5">Trip</th>
              <th className="px-3 py-2.5">Jarak</th>
              <th className="px-3 py-2.5">Tarif/Ton</th>
              <th className="px-3 py-2.5">Target</th>
              <th className="px-3 py-2.5">Tempo</th>
              <th className="px-3 py-2.5">Status</th>
              {canWrite && <th className="px-3 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-neutral-400">
                  Belum ada customer/project.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium">{row.customerName}</td>
                  <td className="px-3 py-2.5">{row.loadingLocation}</td>
                  <td className="px-3 py-2.5">{row.dumpingLocation}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {row.trips.filter((t) => t.isActive).length === 0 ? (
                      <span className="text-neutral-400">Belum ada</span>
                    ) : (
                      row.trips
                        .filter((t) => t.isActive)
                        .map((t) => (
                          <span key={t.id} className="block">
                            {t.name}
                          </span>
                        ))
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(row.oneWayDistance, 1)} km
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatRupiah(row.ratePerTon)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(row.targetTonase, 0)} t
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.paymentTermDays === 0 ? "Tunai" : `${row.paymentTermDays} hari`}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.isActive ? "Aktif" : "Nonaktif"}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2.5 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(row.id, row.customerName)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormDialog
        open={open}
        title={editingId ? "Edit Customer" : "Tambah Customer"}
        onClose={() => setOpen(false)}
        wide
      >
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nama Customer / Project</Label>
            <Input
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>
          <div>
            <Label>Lokasi Loading</Label>
            <Input
              required
              value={form.loadingLocation}
              onChange={(e) =>
                setForm({ ...form, loadingLocation: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Lokasi Dumping</Label>
            <Input
              required
              value={form.dumpingLocation}
              onChange={(e) =>
                setForm({ ...form, dumpingLocation: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Jarak One Way (km)</Label>
            <DecimalInput
              required
              decimals={1}
              value={form.oneWayDistance}
              onChange={(oneWayDistance) =>
                setForm({ ...form, oneWayDistance })
              }
            />
          </div>
          <div>
            <Label>Tarif / Ton</Label>
            <MoneyInput
              required
              value={form.ratePerTon}
              onChange={(ratePerTon) => setForm({ ...form, ratePerTon })}
            />
          </div>
          <div>
            <Label>Target Tonase</Label>
            <DecimalInput
              decimals={2}
              value={form.targetTonase}
              onChange={(targetTonase) => setForm({ ...form, targetTonase })}
            />
          </div>
          <div>
            <Label>Tempo Pembayaran (hari)</Label>
            <IntegerInput
              value={form.paymentTermDays}
              onChange={(paymentTermDays) =>
                setForm({ ...form, paymentTermDays })
              }
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              0 = tunai / bayar langsung. Jatuh tempo invoice = tgl invoice + tempo.
            </p>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.isActive ? "1" : "0"}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.value === "1" })
              }
            >
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </Select>
          </div>

          <TripsEditor trips={trips} onChange={setTrips} customerRate={form.ratePerTon} />

          {error && <p className="sm:col-span-2 text-sm font-medium">{error}</p>}

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}

function TripsEditor({
  trips,
  onChange,
  customerRate,
}: {
  trips: TripForm[];
  onChange: (trips: TripForm[]) => void;
  customerRate: number;
}) {
  function update(key: string, patch: Partial<TripForm>) {
    onChange(trips.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }
  return (
    <div className="sm:col-span-2 rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Trip / Rute</p>
          <p className="text-[11px] text-neutral-500">
            Nama trip dipilih supir saat upload. Tarif kosong = ikut tarif customer
            ({formatRupiah(customerRate || 0)}/ton).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...trips, newTrip()])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Trip
        </Button>
      </div>
      <div className="space-y-2">
        <div className="hidden grid-cols-12 gap-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500 sm:grid">
          <span className="col-span-4">Nama trip</span>
          <span className="col-span-2">Jarak (km)</span>
          <span className="col-span-2">Tarif/ton</span>
          <span className="col-span-2">Uang jalan</span>
          <span className="col-span-2">Aktif</span>
        </div>
        {trips.map((t) => (
          <div key={t.key} className="grid grid-cols-12 items-center gap-2">
            <Input
              className="col-span-12 sm:col-span-4"
              placeholder="mis. Pit A → Port Samarinda"
              required
              value={t.name}
              onChange={(e) => update(t.key, { name: e.target.value })}
            />
            <DecimalField
              className="col-span-4 sm:col-span-2"
              decimals={1}
              placeholder="km"
              value={t.distanceKm}
              onChange={(distanceKm) => update(t.key, { distanceKm })}
            />
            <MoneyField
              className="col-span-4 sm:col-span-2"
              placeholder="ikut customer"
              value={t.ratePerTon}
              onChange={(ratePerTon) => update(t.key, { ratePerTon })}
            />
            <MoneyField
              className="col-span-4 sm:col-span-2"
              placeholder="0"
              value={t.uangJalan}
              onChange={(uangJalan) => update(t.key, { uangJalan })}
            />
            <div className="col-span-12 flex items-center justify-between gap-2 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-900"
                checked={t.isActive}
                onChange={(e) => update(t.key, { isActive: e.target.checked })}
                aria-label="Trip aktif"
              />
              <button
                type="button"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                disabled={trips.length === 1}
                onClick={() => onChange(trips.filter((x) => x.key !== t.key))}
                aria-label="Hapus trip"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
