import Link from "next/link";
import { Construction } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description: string;
  phase: string;
  nextHint?: string;
};

export function ComingSoon({
  title,
  description,
  phase,
  nextHint,
}: ComingSoonProps) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-900">
        <Construction className="h-6 w-6" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {phase}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-600">
        {description}
      </p>
      {nextHint && (
        <p className="mx-auto mt-4 max-w-md text-xs text-neutral-400">{nextHint}</p>
      )}
      <Link
        href="/dashboard"
        className="mt-6 inline-block text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
      >
        ← Kembali ke Dashboard
      </Link>
    </div>
  );
}
