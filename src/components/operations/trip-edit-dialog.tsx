"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryOrderStatus } from "@prisma/client";
import type { DoDriverPayMode } from "@/lib/operations/driver-pay-mode";
import {
  DriverPayFields,
  driverPayFormFromMaster,
} from "@/components/operations/driver-pay-fields";
import type { MasterDriverPayProfile } from "@/lib/operations/driver-pay";
import { updateDoTrip } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { DecimalField, MoneyField } from "@/components/ui/number-input";
import { FormDialog } from "@/components/masters/form-dialog";
import { DO_STATUS_LABEL, isDoEditable } from "@/lib/operations/do-status";
import { formatRupiah } from "@/lib/utils";

export type TripEditData = {
  id: string;
  internalTripId: string;
  date: string;
  unitId: string;
  driverId: string;
  customerTripId: string | null;
  customerId: string | null;
  /** Set when the DO is already on an invoice */
  invoiceNumber: string | null;
  uangJalan: number;
  ratePerTon: number;
  notes: string | null;
  status: DeliveryOrderStatus;
  ticketNumber: string | null;
  netto: number | null;
  kmHauling: number | null;
  solarLiters: number | null;
  solarPricePerLiter: number | null;
  otherAmount: number | null;
  otherDescription: string | null;
  driverPayMode: DoDriverPayMode;
  driverPayAmount: number | null;
};

export type TripEditOptions = {
  units: { id: string; unitNumber: string; defaultDriverId: string | null }[];
  drivers: ({ id: string; name: string } & MasterDriverPayProfile)[];
  trips: {
    id: string;
    customerId: string;
    name: string;
    customerName: string;
    ratePerTon: number;
    uangJalan: number;
  }[];
};

type FormState = {
  date: string;
  unitId: string;
  driverId: string;
  customerTripId: string;
  uangJalan: string;
  ratePerTon: string;
  notes: string;
  ticketNumber: string;
  netto: string;
  kmHauling: string;
  solarLiters: string;
  solarPricePerLiter: string;
  otherAmount: string;
  otherDescription: string;
  driverPayMode: DoDriverPayMode;
  driverPayAmount: string;
  useMasterDriverPay: boolean;
};

const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function toForm(t: TripEditData): FormState {
  return {
    date: t.date,
    unitId: t.unitId,
    driverId: t.driverId,
    customerTripId: t.customerTripId ?? "",
    uangJalan: str(t.uangJalan),
    ratePerTon: str(t.ratePerTon),
    notes: t.notes ?? "",
    ticketNumber: t.ticketNumber ?? "",
    netto: str(t.netto),
    kmHauling: str(t.kmHauling),
    solarLiters: str(t.solarLiters),
    solarPricePerLiter: str(t.solarPricePerLiter),
    otherAmount: str(t.otherAmount),
    otherDescription: t.otherDescription ?? "",
    driverPayMode: t.driverPayMode,
    driverPayAmount: str(t.driverPayAmount),
    useMasterDriverPay: false,
  };
}

/**
 * Controlled edit dialog. Parent owns `trip` (null = closed).
 */
export function TripEditDialog({
  trip,
  options,
  onClose,
  onSaved,
}: {
  trip: TripEditData | null;
  options: TripEditOptions;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setForm(trip ? toForm(trip) : null);
    setError(null);
  }, [trip]);

  const lockedCustomerId = trip?.invoiceNumber ? trip.customerId : null;
  const tripsByCustomer = useMemo(() => {
    const map = new Map<string, TripEditOptions["trips"]>();
    for (const t of options.trips) {
      if (lockedCustomerId && t.customerId !== lockedCustomerId) continue;
      const list = map.get(t.customerName) ?? [];
      list.push(t);
      map.set(t.customerName, list);
    }
    return Array.from(map.entries());
  }, [options.trips, lockedCustomerId]);

  if (!trip || !form) return null;

  const editable = isDoEditable(trip.status);

  function driverProfile(driverId: string): MasterDriverPayProfile | undefined {
    const d = options.drivers.find((x) => x.id === driverId);
    if (!d) return undefined;
    const {
      salarySystem,
      driverRatePerTon,
      monthlySalary,
      dailySalary,
    } = d;
    return { salarySystem, driverRatePerTon, monthlySalary, dailySalary };
  }

  function onUnitChange(unitId: string) {
    const unit = options.units.find((u) => u.id === unitId);
    setForm((f) => {
      if (!f) return f;
      const driverId = unit?.defaultDriverId || f.driverId;
      const pay =
        f.useMasterDriverPay && driverProfile(driverId)
          ? driverPayFormFromMaster(driverProfile(driverId)!)
          : {};
      return { ...f, unitId, driverId, ...pay };
    });
  }

  function onDriverChange(driverId: string) {
    setForm((f) => {
      if (!f) return f;
      const pay =
        f.useMasterDriverPay && driverProfile(driverId)
          ? driverPayFormFromMaster(driverProfile(driverId)!)
          : {};
      return { ...f, driverId, ...pay };
    });
  }

  function onTripChange(customerTripId: string) {
    const t = options.trips.find((x) => x.id === customerTripId);
    setForm((f) =>
      f
        ? {
            ...f,
            customerTripId,
            ratePerTon: t ? String(t.ratePerTon) : f.ratePerTon,
            uangJalan: t ? String(t.uangJalan) : f.uangJalan,
          }
        : f
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip || !form) return;
    setError(null);
    startTransition(async () => {
      const res = await updateDoTrip({
        id: trip.id,
        date: form.date,
        unitId: form.unitId,
        driverId: form.driverId,
        customerTripId: form.customerTripId,
        uangJalan: form.uangJalan || 0,
        ratePerTon: form.ratePerTon || 0,
        ticketNumber: form.ticketNumber,
        netto: form.netto,
        kmHauling: form.kmHauling,
        solarLiters: form.solarLiters,
        solarPricePerLiter: form.solarPricePerLiter,
        otherAmount: form.otherAmount,
        otherDescription: form.otherDescription || null,
        notes: form.notes || null,
        driverPayMode: form.driverPayMode,
        driverPayAmount: form.driverPayAmount,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onClose();
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <FormDialog
      open
      title={`Edit DO ${trip.internalTripId}`}
      onClose={onClose}
      wide
    >
      {!editable ? (
        <p className="text-sm text-neutral-600">
          DO berstatus <strong>{DO_STATUS_LABEL[trip.status]}</strong> sudah
          dikunci dan tidak bisa diedit.
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          {trip.invoiceNumber && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              DO ini sudah masuk invoice <b>{trip.invoiceNumber}</b> (
              {DO_STATUS_LABEL[trip.status]}). Perubahan tonase / tarif akan menghitung ulang
              total invoice. Trip hanya bisa diganti ke rute customer yang sama.
            </p>
          )}
          <div>
            <Label>Tanggal</Label>
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <Label>Trip</Label>
            <Select
              required
              value={form.customerTripId}
              onChange={(e) => onTripChange(e.target.value)}
            >
              <option value="">— Pilih trip —</option>
              {tripsByCustomer.map(([customer, list]) => (
                <optgroup key={customer} label={customer}>
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatRupiah(t.ratePerTon)}/t)
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Select
              required
              value={form.unitId}
              onChange={(e) => onUnitChange(e.target.value)}
            >
              {options.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Driver</Label>
            <Select
              required
              value={form.driverId}
              onChange={(e) => onDriverChange(e.target.value)}
            >
              {options.drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nomor Tiket</Label>
            <Input
              required
              value={form.ticketNumber}
              onChange={(e) => setForm({ ...form, ticketNumber: e.target.value })}
            />
          </div>
          <div>
            <Label>Tonase (ton)</Label>
            <DecimalField
              required
              decimals={3}
              value={form.netto}
              onChange={(netto) => setForm({ ...form, netto })}
            />
          </div>
          <div>
            <Label>Rate / Ton (Rp)</Label>
            <MoneyField
              value={form.ratePerTon}
              onChange={(ratePerTon) => setForm({ ...form, ratePerTon })}
            />
          </div>
          <div>
            <Label>Uang Jalan (Rp)</Label>
            <MoneyField
              value={form.uangJalan}
              onChange={(uangJalan) => setForm({ ...form, uangJalan })}
            />
          </div>
          {driverProfile(form.driverId) && (
            <div className="sm:col-span-2">
              <DriverPayFields
                master={driverProfile(form.driverId)!}
                mode={form.driverPayMode}
                amount={form.driverPayAmount}
                useMaster={form.useMasterDriverPay}
                onModeChange={(driverPayMode) =>
                  setForm({ ...form, driverPayMode })
                }
                onAmountChange={(driverPayAmount) =>
                  setForm({ ...form, driverPayAmount })
                }
                onUseMasterChange={(useMasterDriverPay) =>
                  setForm({ ...form, useMasterDriverPay })
                }
              />
            </div>
          )}
          <div>
            <Label>KM Hauling</Label>
            <DecimalField
              decimals={1}
              value={form.kmHauling}
              onChange={(kmHauling) => setForm({ ...form, kmHauling })}
            />
          </div>
          <div>
            <Label>Catatan</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3 sm:col-span-2 sm:grid-cols-3">
            <legend className="px-1 text-xs font-semibold text-neutral-600">Solar</legend>
            <div>
              <Label>Liter</Label>
              <DecimalField
                decimals={2}
                placeholder="kosong = tidak isi"
                value={form.solarLiters}
                onChange={(solarLiters) => setForm({ ...form, solarLiters })}
              />
            </div>
            <div>
              <Label>Harga / liter (Rp)</Label>
              <MoneyField
                value={form.solarPricePerLiter}
                onChange={(solarPricePerLiter) =>
                  setForm({ ...form, solarPricePerLiter })
                }
              />
            </div>
            <div>
              <Label>Total</Label>
              <p className="flex h-9 items-center text-sm font-semibold tabular-nums">
                {formatRupiah(
                  Math.round(Number(form.solarLiters || 0) * Number(form.solarPricePerLiter || 0))
                )}
              </p>
            </div>
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-neutral-600">Biaya lain</legend>
            <div>
              <Label>Nominal (Rp)</Label>
              <MoneyField
                placeholder="kosong = tidak ada"
                value={form.otherAmount}
                onChange={(otherAmount) => setForm({ ...form, otherAmount })}
              />
            </div>
            <div>
              <Label>Keterangan</Label>
              <Input
                placeholder="mis. tol, parkir"
                value={form.otherDescription}
                onChange={(e) => setForm({ ...form, otherDescription: e.target.value })}
              />
            </div>
          </fieldset>

          {error && (
            <p className="text-sm font-medium text-neutral-900 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}

/** Self-contained "Edit" button + dialog, for server-rendered pages. */
export function TripEditButton({
  trip,
  options,
}: {
  trip: TripEditData;
  options: TripEditOptions;
}) {
  const [open, setOpen] = useState(false);
  if (!isDoEditable(trip.status)) return null;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Edit DO
      </Button>
      <TripEditDialog
        trip={open ? trip : null}
        options={options}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
