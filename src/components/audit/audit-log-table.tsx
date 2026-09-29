"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/dates";
import {
  ACTION_LABEL,
  diffFields,
  formatValue,
  isEmpty,
  recordLabel,
  sentence,
  summarize,
  tableLabel,
  type RefMap,
} from "@/lib/audit/describe";

export type AuditRow = {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string;
  oldData: unknown;
  newData: unknown;
};

const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ACTION_STYLE: Record<AuditRow["action"], string> = {
  CREATE: "bg-neutral-900 text-white",
  UPDATE: "bg-neutral-200 text-neutral-900",
  DELETE: "border border-neutral-900 text-neutral-900",
};

export function AuditLogTable({ rows, refs }: { rows: AuditRow[]; refs: RefMap }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2">Waktu (WIB)</th>
            <th className="px-3 py-2">Oleh</th>
            <th className="px-3 py-2">Aksi</th>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Ringkasan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-neutral-400">
                Tidak ada entri audit untuk filter ini.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const isOpen = open === r.id;
              const label = recordLabel(r.tableName, r.oldData, r.newData, r.recordId, refs);
              return (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b border-neutral-50 align-top hover:bg-neutral-50"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                  >
                    <td className="px-3 py-2.5 text-neutral-400">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-neutral-600">
                      {fmt.format(new Date(r.timestamp))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {r.userName}
                      <span className="ml-1 text-[10px] uppercase text-neutral-400">{r.userRole}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ACTION_STYLE[r.action]}`}>
                        {ACTION_LABEL[r.action]}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                        {tableLabel(r.tableName)}
                      </p>
                      <p className="truncate font-medium text-neutral-900">{label}</p>
                    </td>
                    <td className="max-w-[380px] px-3 py-2.5 text-xs text-neutral-600">
                      <p className="line-clamp-2">
                        {summarize(r.tableName, r.action, r.oldData, r.newData, refs)}
                      </p>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <td />
                      <td colSpan={5} className="px-3 py-4">
                        <Detail row={r} label={label} refs={refs} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

function Value({ table, k, v, refs, strong }: { table: string; k: string; v: unknown; refs: RefMap; strong?: boolean }) {
  const f = formatValue(table, k, v, refs);
  if (f.href) {
    return (
      <a
        href={f.href}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        {f.text}
      </a>
    );
  }
  return <span className={strong ? "font-semibold text-neutral-900" : undefined}>{f.text}</span>;
}

function Detail({ row, label, refs }: { row: AuditRow; label: string; refs: RefMap }) {
  const [showAll, setShowAll] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const table = row.tableName;
  const all = diffFields(table, row.oldData, row.newData);
  const visible = all.filter((d) => !d.hidden);

  const isUpdate = row.action === "UPDATE";
  const valueOf = (d: (typeof all)[number]) => (row.action === "DELETE" ? d.before : d.after);
  const main = isUpdate ? visible.filter((d) => d.changed) : visible.filter((d) => !isEmpty(valueOf(d)));
  const rest = isUpdate ? visible.filter((d) => !d.changed) : visible.filter((d) => isEmpty(valueOf(d)));
  const shown = showAll ? [...main, ...rest] : main;

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-800">
        {sentence(row.userName, row.action, table, label, row.timestamp)}.
      </p>

      {shown.length === 0 ? (
        <p className="text-xs text-neutral-400">Tidak ada detail yang bisa ditampilkan.</p>
      ) : (
        <table className="w-full max-w-3xl text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500">
              <th className="w-56 py-1.5 pr-3 text-left font-medium">Keterangan</th>
              {isUpdate ? (
                <>
                  <th className="py-1.5 pr-3 text-left font-medium">Sebelum</th>
                  <th className="py-1.5 text-left font-medium">Sesudah</th>
                </>
              ) : (
                <th className="py-1.5 text-left font-medium">
                  {row.action === "DELETE" ? "Nilai terakhir" : "Nilai"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const dim = isUpdate ? !d.changed : isEmpty(valueOf(d));
              return (
                <tr key={d.key} className={`border-b border-neutral-100 ${dim ? "text-neutral-400" : ""}`}>
                  <td className="py-1.5 pr-3 text-neutral-600">{d.label}</td>
                  {isUpdate ? (
                    <>
                      <td className={`py-1.5 pr-3 ${d.changed ? "text-neutral-500 line-through decoration-neutral-300" : ""}`}>
                        <Value table={table} k={d.key} v={d.before} refs={refs} />
                      </td>
                      <td className="py-1.5">
                        <Value table={table} k={d.key} v={d.after} refs={refs} strong={d.changed} />
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5">
                      <Value table={table} k={d.key} v={valueOf(d)} refs={refs} strong={!dim} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap gap-4 text-xs">
        {rest.length > 0 && (
          <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll
              ? "Sembunyikan yang lain"
              : isUpdate
                ? `Tampilkan ${rest.length} data yang tidak berubah`
                : `Tampilkan ${rest.length} data kosong`}
          </button>
        )}
        <button type="button" className="text-neutral-500 underline-offset-2 hover:underline" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "Tutup data teknis" : "Data teknis (untuk developer)"}
        </button>
      </div>

      {showRaw && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="mb-2 font-mono text-[11px] text-neutral-500">
            {table} · {row.recordId}
          </p>
          <table className="w-full text-[11px]">
            <tbody>
              {all.map((d) => (
                <tr key={d.key} className={d.changed ? "" : "text-neutral-400"}>
                  <td className="w-48 py-0.5 pr-3 font-mono">{d.key}</td>
                  <td className="break-all py-0.5 pr-3 font-mono">{raw(d.before)}</td>
                  <td className="break-all py-0.5 font-mono">{raw(d.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function raw(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}
