import { redirect } from "next/navigation";
import { AuditAction, type Prisma } from "@prisma/client";
import { AuditLogTable } from "@/components/audit/audit-log-table";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { requireSession } from "@/lib/auth/session";
import { canAccessAudit } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { addDays, parseWibDateTime, tryParseDateOnly } from "@/lib/dates";
import { ACTION_LABEL, collectRefIds, tableLabel, type RefMap } from "@/lib/audit/describe";

/** Resolve every id mentioned in the logs to something a person recognises */
async function resolveRefs(ids: string[]): Promise<RefMap> {
  if (ids.length === 0) return {};
  const where = { id: { in: ids } };
  const [units, drivers, customers, users, invoices, dos, submissions, trips] = await Promise.all([
    prisma.masterUnit.findMany({ where, select: { id: true, unitNumber: true } }),
    prisma.masterDriver.findMany({ where, select: { id: true, name: true } }),
    prisma.masterCustomer.findMany({ where, select: { id: true, customerName: true } }),
    prisma.user.findMany({ where, select: { id: true, name: true } }),
    prisma.invoice.findMany({ where, select: { id: true, invoiceNumber: true } }),
    prisma.deliveryOrder.findMany({ where, select: { id: true, internalTripId: true } }),
    prisma.fieldSubmission.findMany({
      where,
      select: { id: true, date: true, driver: { select: { name: true } } },
    }),
    prisma.customerTrip.findMany({
      where,
      select: { id: true, name: true, customer: { select: { customerName: true } } },
    }),
  ]);
  const refs: RefMap = {};
  for (const u of units) refs[u.id] = u.unitNumber;
  for (const d of drivers) refs[d.id] = d.name;
  for (const c of customers) refs[c.id] = c.customerName;
  for (const u of users) refs[u.id] = u.name;
  for (const i of invoices) refs[i.id] = i.invoiceNumber;
  for (const d of dos) refs[d.id] = d.internalTripId;
  for (const f of submissions) {
    refs[f.id] = `Upload ${f.driver.name} ${f.date.toISOString().slice(0, 10)}`;
  }
  for (const t of trips) refs[t.id] = `${t.name} (${t.customer.customerName})`;
  return refs;
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = {
  table?: string;
  action?: string;
  user?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
};

function dateParam(v: string | undefined): string | null {
  return v && tryParseDateOnly(v) ? v.slice(0, 10) : null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!canAccessAudit(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const from = dateParam(searchParams.from);
  const to = dateParam(searchParams.to);
  const action = Object.values(AuditAction).includes(
    searchParams.action as AuditAction
  )
    ? (searchParams.action as AuditAction)
    : null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() || null;

  const where: Prisma.AuditLogWhereInput = {
    ...(searchParams.table ? { tableName: searchParams.table } : {}),
    ...(action ? { action } : {}),
    ...(searchParams.user ? { userId: searchParams.user } : {}),
    ...(q ? { recordId: { contains: q, mode: "insensitive" } } : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: parseWibDateTime(`${from}T00:00`) } : {}),
            ...(to ? { lt: parseWibDateTime(`${addDays(to, 1)}T00:00`) } : {}),
          },
        }
      : {}),
  };

  const [logs, total, tables, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["tableName"],
      select: { tableName: true },
      orderBy: { tableName: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const refs = await resolveRefs(
    Array.from(
      new Set([
        ...collectRefIds(logs.flatMap((l) => [l.oldData, l.newData])),
        ...logs.map((l) => l.recordId),
      ])
    )
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `/audit?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-neutral-500">
          Siapa mengubah apa dan kapan — invoice, pembayaran, DO, verifikasi, master data, user.
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-7"
      >
        <div>
          <Label>Data</Label>
          <Select name="table" defaultValue={searchParams.table ?? ""}>
            <option value="">Semua</option>
            {tables.map((t) => (
              <option key={t.tableName} value={t.tableName}>
                {tableLabel(t.tableName)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Aksi</Label>
          <Select name="action" defaultValue={action ?? ""}>
            <option value="">Semua</option>
            {Object.values(AuditAction).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a] ?? a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>User</Label>
          <Select name="user" defaultValue={searchParams.user ?? ""}>
            <option value="">Semua</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Dari</Label>
          <Input type="date" name="from" defaultValue={from ?? ""} />
        </div>
        <div>
          <Label>Sampai</Label>
          <Input type="date" name="to" defaultValue={to ?? ""} />
        </div>
        <div>
          <Label>Record ID</Label>
          <Input name="q" placeholder="cari ID…" defaultValue={q ?? ""} />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="w-full">
            Filter
          </Button>
          <a
            href="/audit"
            className="text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            Reset
          </a>
        </div>
      </form>

      <AuditLogTable
        refs={refs}
        rows={logs.map((l) => ({
          id: l.id,
          timestamp: l.timestamp.toISOString(),
          userName: l.user.name,
          userRole: l.user.role,
          action: l.action,
          tableName: l.tableName,
          recordId: l.recordId,
          oldData: l.oldData ?? null,
          newData: l.newData ?? null,
        }))}
      />

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {total.toLocaleString("id-ID")} entri · halaman {page} / {pageCount}
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <a className="font-medium text-neutral-900 hover:underline" href={pageHref(page - 1)}>
              ← Sebelumnya
            </a>
          )}
          {page < pageCount && (
            <a className="font-medium text-neutral-900 hover:underline" href={pageHref(page + 1)}>
              Berikutnya →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
