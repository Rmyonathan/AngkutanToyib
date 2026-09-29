import { UnitStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  UnitStatus,
  { label: string; dot: string; className: string }
> = {
  RUNNING: {
    label: "Running",
    dot: "🟢",
    className: "border-neutral-300 bg-white text-neutral-900",
  },
  STANDBY: {
    label: "Standby",
    dot: "🟡",
    className: "border-neutral-300 bg-neutral-50 text-neutral-700",
  },
  BREAKDOWN: {
    label: "Breakdown",
    dot: "🔴",
    className: "border-neutral-400 bg-neutral-100 text-neutral-900",
  },
  MAINTENANCE: {
    label: "Maintenance",
    dot: "🔵",
    className: "border-neutral-300 bg-neutral-50 text-neutral-700",
  },
};

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.className
      )}
    >
      <span aria-hidden>{meta.dot}</span>
      {meta.label}
    </span>
  );
}
