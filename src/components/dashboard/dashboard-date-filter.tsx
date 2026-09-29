"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDays,
  addMonths,
  diffDays,
  monthEnd,
  monthStart,
  todayDateOnly,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type Props = { from: string; to: string };

function isFullMonth(from: string, to: string) {
  return from === monthStart(from) && to === monthEnd(from);
}

export function DashboardDateFilter({ from, to }: Props) {
  const router = useRouter();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const today = todayDateOnly();
  const go = (f: string, t: string) => {
    let [a, b] = f <= t ? [f, t] : [t, f];
    if (b > today) b = today;
    if (a > b) a = b;
    router.push(a === b ? `/dashboard?date=${a}` : `/dashboard?from=${a}&to=${b}`);
  };

  const presets: { label: string; from: string; to: string }[] = [
    { label: "Hari ini", from: today, to: today },
    { label: "Kemarin", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "7 hari", from: addDays(today, -6), to: today },
    { label: "Bulan ini", from: monthStart(today), to: today },
    {
      label: "Bulan lalu",
      from: addMonths(today, -1),
      to: monthEnd(addMonths(today, -1)),
    },
  ];

  const shift = (dir: 1 | -1) => {
    if (isFullMonth(from, to) || (from === monthStart(from) && to === today && dir === -1)) {
      const m = addMonths(from, dir);
      go(m, monthEnd(m));
      return;
    }
    const len = diffDays(from, to) + 1;
    go(addDays(from, dir * len), addDays(to, dir * len));
  };
  const canForward = to < today;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => go(p.from, p.to)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-md border border-neutral-300 p-1.5 hover:bg-neutral-50"
          aria-label="Periode sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          Bulan
          <Input
            type="month"
            className="h-9 w-36"
            value={isFullMonth(from, to) || (from === monthStart(from) && to === today) ? from.slice(0, 7) : ""}
            max={today.slice(0, 7)}
            onChange={(e) => {
              if (!e.target.value) return;
              const m = `${e.target.value}-01`;
              go(m, m.slice(0, 7) === today.slice(0, 7) ? today : monthEnd(m));
            }}
          />
        </label>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftFrom && draftTo) go(draftFrom, draftTo);
          }}
        >
          <Input
            type="date"
            className="h-9 w-36"
            value={draftFrom}
            max={today}
            onChange={(e) => setDraftFrom(e.target.value)}
            aria-label="Dari tanggal"
          />
          <span className="text-xs text-neutral-400">s/d</span>
          <Input
            type="date"
            className="h-9 w-36"
            value={draftTo}
            max={today}
            onChange={(e) => setDraftTo(e.target.value)}
            aria-label="Sampai tanggal"
          />
          <Button type="submit" size="sm" variant="outline">
            Lihat
          </Button>
        </form>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canForward}
          className="rounded-md border border-neutral-300 p-1.5 hover:bg-neutral-50 disabled:opacity-30"
          aria-label="Periode berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
