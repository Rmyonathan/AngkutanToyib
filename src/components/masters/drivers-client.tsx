"use client";

import { useMemo, useState, useTransition } from "react";
import { AttendanceStatus, SalarySystem } from "@prisma/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createDriver,
  deleteDriver,
  updateDriver,
  type DriverInput,
} from "@/actions/masters/drivers";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormDialog } from "@/components/masters/form-dialog";
import { formatRupiah } from "@/lib/utils";

export type DriverRow = {
  id: string;
  name: string;
  driverId: string;
  unitId: string | null;
  unitNumber: string | null;
  username: string | null;
  loginActive: boolean;
  salarySystem: SalarySystem;
  driverRatePerTon: number;
  monthlySalary: number | null;
  dailySalary: number | null;
  attendanceStatus: AttendanceStatus;
};

type UnitOption = {
  id: string;
  unitNumber: string;
  driverId: string | null;
  driverName: string | null;
};

type DriverForm = {
  name: string;
  driverId: string;
  unitId: string;
  salarySystem: SalarySystem;
  driverRatePerTon: number;
  monthlySalary: number | "";
  dailySalary: number | "";
  attendanceStatus: AttendanceStatus;
  username: string;
  password: string;
};

const emptyForm = (): DriverForm => ({
  name: "",
  driverId: "",
  unitId: "",
  username: "",
  password: "",
  salarySystem: SalarySystem.PER_TON,
  driverRatePerTon: 0,
  monthlySalary: "",
  dailySalary: "",
  attendanceStatus: AttendanceStatus.ACTIVE,
});

export function DriversClient({
  drivers,
  units,
  canWrite,
}: {
  drivers: DriverRow[];
  units: UnitOption[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm());
  const [hasAccount, setHasAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setHasAccount(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(row: DriverRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      driverId: row.driverId,
      unitId: row.unitId ?? "",
      username: row.username ?? "",
      password: "",
      salarySystem: row.salarySystem,
      driverRatePerTon: row.driverRatePerTon,
      monthlySalary: row.monthlySalary ?? ("" as const),
      dailySalary: row.dailySalary ?? ("" as const),
      attendanceStatus: row.attendanceStatus,
    });
    setHasAccount(!!row.username);
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload: DriverInput = {
        ...form,
        unitId: form.unitId || null,
        password: form.password || null,
      };
      const res = editingId
        ? await updateDriver(editingId, payload)
        : await createDriver(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  function onDelete(id: string, label: string) {
    if (!confirm(`Hapus driver ${label}?`)) return;
    startTransition(async () => {
      const res = await deleteDriver(id);
      if (!res.success) alert(res.error);
    });
  }

  const sorted = useMemo(
    () => [...drivers].sort((a, b) => a.name.localeCompare(b.name)),
    [drivers]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Master Driver</h1>
          <p className="text-sm text-neutral-500">
            Setiap driver punya akun login sendiri — upload dokumen otomatis tercatat atas nama driver &amp; mobilnya
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
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2.5">Nama</th>
              <th className="px-3 py-2.5">ID</th>
              <th className="px-3 py-2.5">Mobil</th>
              <th className="px-3 py-2.5">Login</th>
              <th className="px-3 py-2.5">Sistem Gaji</th>
              <th className="px-3 py-2.5">Rate</th>
              <th className="px-3 py-2.5">Absensi</th>
              {canWrite && <th className="px-3 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-neutral-400">
                  Belum ada driver.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5">{row.driverId}</td>
                  <td className="px-3 py-2.5">{row.unitNumber ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {row.username ? (
                      <span className={row.loginActive ? "" : "text-neutral-400 line-through"}>
                        {row.username}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">Belum ada akun</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{row.salarySystem}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.salarySystem === "PER_TON"
                      ? `${formatRupiah(row.driverRatePerTon)}/ton`
                      : row.salarySystem === "MONTHLY"
                        ? formatRupiah(row.monthlySalary ?? 0)
                        : formatRupiah(row.dailySalary ?? 0)}
                  </td>
                  <td className="px-3 py-2.5">{row.attendanceStatus}</td>
                  {canWrite && (
                    <td className="px-3 py-2.5 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(row.id, row.name)}
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
        title={editingId ? "Edit Driver" : "Tambah Driver"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nama</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>ID Driver</Label>
            <Input
              required
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            />
          </div>
          <div>
            <Label>Mobil / Unit</Label>
            <Select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            >
              <option value="">— Belum di-assign —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                  {u.driverName && u.driverId !== editingId
                    ? ` (sekarang: ${u.driverName})`
                    : ""}
                </option>
              ))}
            </Select>
          </div>

          <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-neutral-700">
              Akun Login Supir
            </legend>
            <div>
              <Label>Username</Label>
              <Input
                required
                autoComplete="off"
                placeholder="mis. budi"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })
                }
              />
            </div>
            <div>
              <Label>{hasAccount ? "Password baru (opsional)" : "Password"}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                required={!hasAccount}
                minLength={8}
                placeholder={hasAccount ? "kosongkan = tidak diubah" : "min. 8 karakter"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <p className="text-[11px] text-neutral-500 sm:col-span-2">
              Supir login di halaman yang sama dengan username ini. Absensi
              INACTIVE = akun tidak bisa login.
            </p>
          </fieldset>
          <div>
            <Label>Sistem Gaji</Label>
            <Select
              value={form.salarySystem}
              onChange={(e) =>
                setForm({ ...form, salarySystem: e.target.value as SalarySystem })
              }
            >
              {Object.values(SalarySystem).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Absensi</Label>
            <Select
              value={form.attendanceStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  attendanceStatus: e.target.value as AttendanceStatus,
                })
              }
            >
              {Object.values(AttendanceStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Rate / Ton</Label>
            <Input
              type="number"
              value={form.driverRatePerTon}
              onChange={(e) =>
                setForm({ ...form, driverRatePerTon: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Gaji Bulanan</Label>
            <Input
              type="number"
              value={form.monthlySalary ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthlySalary: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label>Gaji Harian</Label>
            <Input
              type="number"
              value={form.dailySalary ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  dailySalary: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </div>

          {error && <p className="sm:col-span-2 text-sm">{error}</p>}

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
