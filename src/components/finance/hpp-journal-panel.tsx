"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  JournalCategory,
  JournalEntryType,
} from "@prisma/client";
import {
  createHppJournalEntry,
  deleteHppJournalEntry,
} from "@/actions/finance/journal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormDialog } from "@/components/masters/form-dialog";
import { formatRupiah } from "@/lib/utils";
import { todayDateOnly } from "@/lib/dates";
import type {
  JournalLedgerRow,
  LedgerSource,
} from "@/lib/finance/get-financial-hpp";

const ENTRY_TYPES: { value: JournalEntryType; label: string }[] = [
  { value: JournalEntryType.CASH_OUT, label: "Kas Keluar (biaya)" },
  { value: JournalEntryType.CASH_IN, label: "Kas Masuk (pendapatan)" },
];

const CATEGORIES: { value: JournalCategory; label: string }[] = [
  { value: JournalCategory.SOLAR, label: "Solar" },
  { value: JournalCategory.DRIVER, label: "Driver" },
  { value: JournalCategory.TIRE, label: "Ban" },
  { value: JournalCategory.MAINTENANCE, label: "Maintenance" },
  { value: JournalCategory.CICILAN, label: "Cicilan" },
  { value: JournalCategory.MOVING, label: "Moving" },
  { value: JournalCategory.UANG_JALAN, label: "Uang Jalan" },
  { value: JournalCategory.BIAYA_LAIN, label: "Biaya Lain" },
  { value: JournalCategory.REVENUE, label: "Revenue / Pendapatan" },
  { value: JournalCategory.OTHER, label: "Lainnya" },
];

function todayIso() {
  return todayDateOnly();
}

const SOURCE_LABEL: Record<LedgerSource, string> = {
  PEMBAYARAN: "Pembayaran",
  UANG_JALAN: "Uang Jalan",
  BIAYA_OPS: "Biaya Ops",
  BREAKDOWN: "Breakdown",
  JOURNAL: "Jurnal",
};

function categoryLabel(c: JournalCategory) {
  if (c === JournalCategory.DEPRECIATION) return "Depresiasi";
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function HppJournalPanel({
  journals,
  units,
  canWrite,
}: {
  journals: JournalLedgerRow[];
  units: { id: string; unitNumber: string }[];
  canWrite: boolean;
}) {
  const [date, setDate] = useState(todayIso());
  const [entryType, setEntryType] = useState<JournalEntryType>(
    JournalEntryType.CASH_OUT
  );
  const [category, setCategory] = useState<JournalCategory>(
    JournalCategory.BIAYA_LAIN
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [unitId, setUnitId] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggestedCategory = useMemo(() => {
    if (entryType === JournalEntryType.CASH_IN) return JournalCategory.REVENUE;
    return JournalCategory.BIAYA_LAIN;
  }, [entryType]);

  function onEntryTypeChange(v: JournalEntryType) {
    setEntryType(v);
    if (v === JournalEntryType.CASH_IN) setCategory(JournalCategory.REVENUE);
    else if (category === JournalCategory.REVENUE)
      setCategory(JournalCategory.BIAYA_LAIN);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await createHppJournalEntry({
        date,
        entryType,
        category,
        description,
        amount: Number(amount),
        unitId: unitId || null,
        notes: notes || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOk("Jurnal tersimpan.");
      setDescription("");
      setAmount("");
      setNotes("");
      setUnitId("");
      setCategory(suggestedCategory);
      setOpen(false);
    });
  }

  function onDelete(id: string) {
    if (!canWrite) return;
    if (!confirm("Hapus entri jurnal ini?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHppJournalEntry(id);
      if (!res.success) setError(res.error);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Pergerakan Kas
          </h2>
          <p className="text-xs text-neutral-400">
            Pembayaran customer, uang jalan, solar/biaya lain terverifikasi & biaya
            breakdown muncul otomatis. Kas keluar / masuk lain dicatat lewat Input Jurnal.
          </p>
        </div>
        {canWrite && (
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Input Jurnal
          </Button>
        )}
      </div>
      {ok && <p className="px-4 text-sm text-neutral-700">{ok}</p>}
      {error && !open && <p className="px-4 text-sm text-red-600">{error}</p>}

      <FormDialog open={open} title="Input Jurnal Kas" onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tanggal</Label>
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Jenis</Label>
            <Select
              value={entryType}
              onChange={(e) =>
                onEntryTypeChange(e.target.value as JournalEntryType)
              }
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Kategori</Label>
            <Select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as JournalCategory)
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            {entryType === JournalEntryType.CASH_OUT &&
              category === JournalCategory.DRIVER && (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Bayar gaji supir: mengurangi kas saja — gajinya sudah dihitung per DO
                  di laba-rugi.
                </p>
              )}
          </div>
          <div className="sm:col-span-2">
            <Label>Keterangan</Label>
            <Input
              required
              placeholder="Contoh: Beli solar SPBU X / Bayar servis unit"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <Input
              type="number"
              required
              min={1}
              step={1}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Unit (opsional)</Label>
            <Select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">— Tidak di-assign —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Catatan</Label>
            <Input
              placeholder="Opsional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan Jurnal"}
            </Button>
          </div>
        </form>
      </FormDialog>

      <div className="overflow-x-auto border-t border-neutral-100">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Sumber</th>
              <th className="px-4 py-2">Jenis</th>
              <th className="px-4 py-2">Kategori</th>
              <th className="px-4 py-2">Keterangan</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Nominal</th>
              <th className="px-4 py-2">Oleh</th>
              {canWrite && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {journals.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 9 : 8}
                  className="px-4 py-8 text-center text-neutral-400"
                >
                  Belum ada pergerakan kas bulan ini.
                </td>
              </tr>
            ) : (
              journals.map((j) => {
                const isOut = j.entryType === JournalEntryType.CASH_OUT;
                const isAuto = j.source !== "JOURNAL";
                const sourceLabel = SOURCE_LABEL[j.source];
                return (
                  <tr
                    key={j.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">{j.date}</td>
                    <td className="px-4 py-2.5">
                      {j.href ? (
                        <Link
                          href={j.href}
                          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:underline"
                        >
                          {sourceLabel}
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-neutral-600">
                          {sourceLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-medium ${
                          isOut ? "text-neutral-700" : "text-neutral-900"
                        }`}
                      >
                        {isOut ? "Keluar" : "Masuk"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {categoryLabel(j.category)}
                    </td>
                    <td className="px-4 py-2.5 max-w-[220px]">
                      <span className="line-clamp-2">{j.description}</span>
                      {j.notes && (
                        <span className="mt-0.5 block text-xs text-neutral-400">
                          {j.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      {j.unitNumber ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 tabular-nums font-medium ${
                        isOut ? "text-neutral-700" : "text-neutral-900"
                      }`}
                    >
                      {isOut ? "−" : "+"}
                      {formatRupiah(j.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-400">
                      {isAuto ? "Auto" : (j.createdByName ?? "—")}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-right">
                        {isAuto ? (
                          <span className="text-xs text-neutral-300">—</span>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onDelete(j.id)}
                            className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
