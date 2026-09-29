"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormDialog } from "@/components/masters/form-dialog";
import {
  RolePermissionsEditor,
  type RolePermissionState,
} from "@/components/users/role-permissions-editor";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastActivity: string | null;
};

const ROLE_INFO: { value: Role; label: string; desc: string }[] = [
  { value: "OWNER", label: "Owner", desc: "Akses penuh, termasuk manajemen user" },
  { value: "MANAGER", label: "Manager", desc: "Default: lihat semua + approve/verifikasi dokumen" },
  { value: "ADMIN", label: "Admin", desc: "Default: input/edit trip, master data, breakdown (tanpa angka keuangan)" },
  { value: "FINANCE", label: "Finance", desc: "Default: revenue, HPP, kas, penagihan & pembayaran" },
  { value: "OPERATOR", label: "Operator / Supir", desc: "Akun supir — dibuat & dikelola dari Master Driver" },
];

type FormState = {
  name: string;
  email: string;
  role: Role;
  password: string;
};

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  role: "ADMIN",
  password: "",
});

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function UsersClient({
  users,
  currentUserId,
  currentRole,
  rolePermissions,
}: {
  users: UserRow[];
  currentUserId: string;
  currentRole: string;
  rolePermissions: RolePermissionState[];
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editingOperator = editingId !== null && form.role === "OPERATOR";
  const roleOptions = ROLE_INFO.filter((r) =>
    editingOperator ? r.value === "OPERATOR" : r.value !== "OPERATOR"
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateUser({
            id: editingId,
            name: form.name,
            email: form.email,
            role: form.role,
          })
        : await createUser(form);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  function toggleActive(u: UserRow) {
    const verb = u.isActive ? "Nonaktifkan" : "Aktifkan";
    if (!confirm(`${verb} ${u.name}?`)) return;
    startTransition(async () => {
      const res = await setUserActive(u.id, !u.isActive);
      if (!res.success) alert(res.error);
    });
  }

  function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setError(null);
    startTransition(async () => {
      const res = await resetUserPassword(resetFor.id, newPassword);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResetFor(null);
      setNewPassword("");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Manajemen User &amp; Role</h1>
          <p className="text-sm text-neutral-500">
            User tidak dihapus (terikat audit log) — nonaktifkan agar tidak bisa login.
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={pending}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah User
        </Button>
      </div>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2.5">Nama</th>
              <th className="px-3 py-2.5">Email / Username</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Aktivitas terakhir</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-neutral-50 ${u.isActive ? "" : "text-neutral-400"}`}
              >
                <td className="px-3 py-2.5 font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">(Anda)</span>
                  )}
                </td>
                <td className="px-3 py-2.5">{u.email}</td>
                <td className="px-3 py-2.5">
                  {ROLE_INFO.find((r) => r.value === u.role)?.label ?? u.role}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      u.isActive ? "bg-neutral-900 text-white" : "border border-neutral-300"
                    }`}
                  >
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-neutral-500">
                  {u.lastActivity ? dateFmt.format(new Date(u.lastActivity)) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Edit"
                      onClick={() => openEdit(u)}
                      disabled={pending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      title="Reset password"
                      onClick={() => {
                        setResetFor(u);
                        setNewPassword("");
                        setError(null);
                      }}
                      disabled={pending}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(u)}
                        disabled={pending}
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <RolePermissionsEditor roles={rolePermissions} currentRole={currentRole} />

      <FormDialog
        open={open}
        title={editingId ? "Edit User" : "Tambah User"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Nama</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Email / username (untuk login)</Label>
            <Input
              type="text"
              autoCapitalize="none"
              autoComplete="off"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              disabled={editingId === currentUserId || editingOperator}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-neutral-400">
              {ROLE_INFO.find((r) => r.value === form.role)?.desc}
            </p>
            {!editingId && (
              <p className="mt-1 text-[11px] text-neutral-500">
                Akun supir dibuat dari <b>Master Data → Driver</b>, bukan di sini.
              </p>
            )}
          </div>
          {!editingId && (
            <div>
              <Label>Password awal</Label>
              <Input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={resetFor !== null}
        title={`Reset password — ${resetFor?.name ?? ""}`}
        onClose={() => setResetFor(null)}
      >
        <form onSubmit={submitReset} className="space-y-3">
          <div>
            <Label>Password baru</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Berikan password ini ke user secara langsung; minta mereka menggantinya.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResetFor(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Reset
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
