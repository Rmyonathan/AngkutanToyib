"use client";

import { useMemo, useState, useTransition } from "react";
import { UnitStatus } from "@prisma/client";
import { Plus, Pencil, Trash2, UserRound } from "lucide-react";
import {
  assignUnitDriver,
  createUnit,
  deleteUnit,
  updateUnit,
  type UnitInput,
} from "@/actions/masters/units";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormDialog } from "@/components/masters/form-dialog";
import { UnitStatusBadge } from "@/components/masters/status-badge";
import { formatNumber } from "@/lib/utils";

export type UnitRow = {
  id: string;
  unitNumber: string;
  brandType: string;
  year: number;
  licensePlate: string;
  capacity: number;
  status: UnitStatus;
  currentKm: number;
  operationStartDate: string | null;
  defaultDriverId: string | null;
  defaultDriverName: string | null;
};

type DriverOption = {
  id: string;
  name: string;
  driverId: string;
  unitNumber: string | null;
};

const emptyForm = (): UnitInput => ({
  unitNumber: "",
  brandType: "",
  year: new Date().getFullYear(),
  licensePlate: "",
  capacity: 30,
  defaultDriverId: "",
  status: UnitStatus.STANDBY,
  currentKm: 0,
  operationStartDate: "",
});

export function UnitsClient({
  units,
  drivers,
  canWrite,
}: {
  units: UnitRow[];
  drivers: DriverOption[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitInput>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assigning, setAssigning] = useState<UnitRow | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const title = editingId ? "Edit Unit" : "Tambah Unit";

  function openAssign(row: UnitRow) {
    setAssigning(row);
    setAssignDriverId(row.defaultDriverId ?? "");
    setAssignError(null);
  }

  function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigning) return;
    setAssignError(null);
    startTransition(async () => {
      const res = await assignUnitDriver(assigning.id, assignDriverId || null);
      if (!res.success) {
        setAssignError(res.error);
        return;
      }
      setAssigning(null);
    });
  }

  const driverLabel = (d: DriverOption, unitNumber?: string) =>
    `${d.name} (${d.driverId})${
      d.unitNumber && d.unitNumber !== unitNumber ? ` — sekarang di ${d.unitNumber}` : ""
    }`;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(row: UnitRow) {
    setEditingId(row.id);
    setForm({
      unitNumber: row.unitNumber,
      brandType: row.brandType,
      year: row.year,
      licensePlate: row.licensePlate,
      capacity: row.capacity,
      defaultDriverId: row.defaultDriverId ?? "",
      status: row.status,
      currentKm: row.currentKm,
      operationStartDate: row.operationStartDate ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        defaultDriverId: form.defaultDriverId || null,
      };
      const res = editingId
        ? await updateUnit(editingId, payload)
        : await createUnit(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  function onDelete(id: string, label: string) {
    if (!confirm(`Hapus unit ${label}?`)) return;
    startTransition(async () => {
      const res = await deleteUnit(id);
      if (!res.success) alert(res.error);
    });
  }

  const sorted = useMemo(
    () => [...units].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber)),
    [units]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Master Unit</h1>
          <p className="text-sm text-neutral-500">
            Nomor unit, merk, polisi, kapasitas, driver, status, KM
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
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2.5">Unit</th>
              <th className="px-3 py-2.5">Merk/Type</th>
              <th className="px-3 py-2.5">Polisi</th>
              <th className="px-3 py-2.5">Kapasitas</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Driver</th>
              <th className="px-3 py-2.5">KM</th>
              {canWrite && <th className="px-3 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-neutral-400">
                  Belum ada unit. Tambahkan armada pertama.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium">{row.unitNumber}</td>
                  <td className="px-3 py-2.5">
                    {row.brandType} ({row.year})
                  </td>
                  <td className="px-3 py-2.5">{row.licensePlate}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(row.capacity, 1)} t
                  </td>
                  <td className="px-3 py-2.5">
                    <UnitStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2.5 text-neutral-600">
                    <div className="flex items-center gap-2">
                      <span>{row.defaultDriverName ?? "—"}</span>
                      {canWrite && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openAssign(row)}
                        >
                          <UserRound className="mr-1 h-3.5 w-3.5" />
                          {row.defaultDriverId ? "Ganti" : "Assign"}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(row.currentKm, 0)}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(row.id, row.unitNumber)}
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
        open={!!assigning}
        title={`Assign Driver — ${assigning?.unitNumber ?? ""}`}
        onClose={() => setAssigning(null)}
      >
        <form onSubmit={submitAssign} className="space-y-3">
          <p className="text-sm text-neutral-600">
            Driver yang dipilih akan login &amp; upload dokumen atas nama unit ini.
            1 driver hanya pegang 1 unit — kalau driver sedang di unit lain, otomatis
            dipindah.
          </p>
          <div>
            <Label>Driver</Label>
            <Select
              value={assignDriverId}
              onChange={(e) => setAssignDriverId(e.target.value)}
            >
              <option value="">— Kosongkan —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {driverLabel(d, assigning?.unitNumber)}
                </option>
              ))}
            </Select>
          </div>
          {assignError && <p className="text-sm font-medium">{assignError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAssigning(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog open={open} title={title} onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nomor Unit</Label>
            <Input
              required
              value={form.unitNumber}
              onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
            />
          </div>
          <div>
            <Label>Merk / Type</Label>
            <Input
              required
              value={form.brandType}
              onChange={(e) => setForm({ ...form, brandType: e.target.value })}
            />
          </div>
          <div>
            <Label>Tahun</Label>
            <Input
              type="number"
              required
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Nomor Polisi</Label>
            <Input
              required
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
            />
          </div>
          <div>
            <Label>Kapasitas (ton)</Label>
            <Input
              type="number"
              step="0.1"
              required
              value={form.capacity}
              onChange={(e) =>
                setForm({ ...form, capacity: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as UnitStatus })
              }
            >
              {Object.values(UnitStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Driver</Label>
            <Select
              value={form.defaultDriverId ?? ""}
              onChange={(e) =>
                setForm({ ...form, defaultDriverId: e.target.value })
              }
            >
              <option value="">— Tidak ada —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {driverLabel(d, form.unitNumber)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Kilometer Saat Ini</Label>
            <Input
              type="number"
              value={form.currentKm}
              onChange={(e) =>
                setForm({ ...form, currentKm: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Tanggal Mulai Operasi</Label>
            <Input
              type="date"
              value={form.operationStartDate ?? ""}
              onChange={(e) =>
                setForm({ ...form, operationStartDate: e.target.value })
              }
            />
          </div>

          {error && (
            <p className="sm:col-span-2 text-sm text-neutral-900">{error}</p>
          )}

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
