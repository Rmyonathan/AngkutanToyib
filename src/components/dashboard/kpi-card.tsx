import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function KpiCard({ title, children, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
