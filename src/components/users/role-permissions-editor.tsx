"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { resetRolePermissions, saveRolePermissions } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { PERMISSION_CATALOG, type Permission } from "@/lib/auth/rbac";
import { ROLE_LABELS } from "@/lib/navigation";

export type RolePermissionState = {
  role: Exclude<Role, "OWNER">;
  permissions: Permission[];
  isCustom: boolean;
};

type Key = (typeof PERMISSION_CATALOG)[number]["key"];

function toggle(current: Set<string>, key: Key, on: boolean): Set<string> {
  const next = new Set(current);
  if (on) {
    next.add(key);
    PERMISSION_CATALOG.find((p) => p.key === key)?.implies?.forEach((i) => next.add(i));
  } else {
    next.delete(key);
    // Anything that requires this permission loses it too
    for (const p of PERMISSION_CATALOG) {
      if (p.implies?.includes(key)) next.delete(p.key);
    }
  }
  return next;
}

export function RolePermissionsEditor({
  roles,
  currentRole,
}: {
  roles: RolePermissionState[];
  currentRole: string;
}) {
  const [state, setState] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.role, new Set(r.permissions)]))
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<string, typeof PERMISSION_CATALOG>();
    for (const p of PERMISSION_CATALOG) {
      m.set(p.group, [...(m.get(p.group) ?? []), p]);
    }
    return Array.from(m.entries());
  }, []);

  const dirty = (role: string) => {
    const saved = new Set<string>(roles.find((r) => r.role === role)?.permissions ?? []);
    const now = state[role];
    return saved.size !== now.size || Array.from(now).some((p) => !saved.has(p));
  };

  function save(role: RolePermissionState["role"]) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveRolePermissions(role, Array.from(state[role]));
      setMessage(
        res.success
          ? { ok: true, text: `Hak akses ${ROLE_LABELS[role]} disimpan. User yang sedang login ikut ter-update dalam ±1 menit.` }
          : { ok: false, text: res.error }
      );
    });
  }

  function reset(role: RolePermissionState["role"]) {
    if (!confirm(`Kembalikan hak akses ${ROLE_LABELS[role]} ke default?`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await resetRolePermissions(role);
      if (!res.success) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: `Hak akses ${ROLE_LABELS[role]} dikembalikan ke default.` });
      window.location.reload();
    });
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Hak Akses Role</h2>
        <p className="text-xs text-neutral-500">
          Centang fitur yang boleh dipakai tiap role, lalu klik Simpan di kolom role tsb. Owner selalu akses penuh.
          Beberapa hak otomatis ikut (mis. &quot;Buat / edit Trip&quot; butuh &quot;Lihat Data Trip&quot;).
        </p>
      </div>

      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2 text-left">Fitur</th>
            <th className="w-24 px-2 py-2 text-center">Owner</th>
            {roles.map((r) => (
              <th key={r.role} className="w-28 px-2 py-2 text-center">
                {ROLE_LABELS[r.role]}
                {r.isCustom && (
                  <span className="block text-[10px] font-normal normal-case text-neutral-400">diubah</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([group, perms]) => (
            <Fragment key={group}>
              <tr className="bg-neutral-50">
                <td colSpan={2 + roles.length} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {group}
                </td>
              </tr>
              {perms.map((p) => (
                <tr key={p.key} className="border-b border-neutral-50">
                  <td className="px-4 py-2">
                    <span className="font-medium text-neutral-900">{p.label}</span>
                    <span className="block text-xs text-neutral-500">{p.description}</span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked disabled aria-label={`Owner: ${p.label}`} />
                  </td>
                  {roles.map((r) => (
                    <td key={r.role} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${ROLE_LABELS[r.role]}: ${p.label}`}
                        checked={state[r.role].has(p.key)}
                        disabled={pending}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            [r.role]: toggle(s[r.role], p.key, e.target.checked),
                          }))
                        }
                        className="h-4 w-4 accent-neutral-900"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200">
            <td className="px-4 py-3 text-xs text-neutral-500">
              {message && (
                <span className={message.ok ? "text-neutral-700" : "text-red-600"}>{message.text}</span>
              )}
            </td>
            <td />
            {roles.map((r) => (
              <td key={r.role} className="px-2 py-3 text-center align-top">
                <div className="flex flex-col items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !dirty(r.role)}
                    onClick={() => save(r.role)}
                  >
                    Simpan
                  </Button>
                  {r.isCustom && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reset(r.role)}
                      className="text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                    >
                      Default
                    </button>
                  )}
                  {r.role === currentRole && (
                    <span className="text-[10px] text-neutral-400">role Anda</span>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
