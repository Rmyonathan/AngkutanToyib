"use client";

import { formatBytes, formatMonthLabel } from "@/lib/storage/format";
import { formatNumber } from "@/lib/utils";
import type { StorageOverview } from "@/lib/storage/get-storage-overview";

function UsageBar({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone =
    pct >= 90 ? "bg-red-600" : pct >= 70 ? "bg-amber-500" : "bg-neutral-900";

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-neutral-600">
        <span>{label}</span>
        <span>
          {formatBytes(used)} / {formatBytes(limit)} ({formatNumber(pct, 0)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StorageOverviewClient({ data }: { data: StorageOverview }) {
  const ut = data.uploadThing;
  const db = data.database;
  const proj = data.projections;

  const displayUsed = ut.totalBytes ?? db.estimatedBytes;
  const displayLimit = ut.limitBytes ?? data.assumptions.freeTierLimitBytes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Penyimpanan Foto</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Estimasi penggunaan UploadThing untuk dokumen lapangan (Surat Jalan, nota solar,
          biaya lain). Hanya Owner.
        </p>
      </div>

      {!ut.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>UploadThing belum aktif.</strong> Set{" "}
          <code className="rounded bg-amber-100 px-1">UPLOADTHING_TOKEN</code> di Railway
          agar foto tidak hilang saat redeploy.
        </div>
      )}

      {ut.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          UploadThing API: {ut.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pemakaian (aktual / estimasi)"
          value={formatBytes(displayUsed)}
          sub={
            ut.totalBytes != null
              ? `${formatNumber(ut.filesUploaded ?? 0, 0)} file di UploadThing`
              : `Estimasi dari ${formatNumber(db.totalPhotoRefs, 0)} foto di database`
          }
        />
        <StatCard
          label="Kuota paket"
          value={formatBytes(displayLimit)}
          sub="Free tier UploadThing = 2 GB"
        />
        <StatCard
          label="Foto bulan ini"
          value={formatNumber(db.photosThisMonth, 0)}
          sub={`Bulan lalu: ${formatNumber(db.photosLastMonth, 0)} foto`}
        />
        <StatCard
          label="Rata-rata / bulan"
          value={formatNumber(proj.avgPhotosPerMonth, 1)}
          sub={`~${formatNumber(proj.avgSubmissionsPerMonth, 1)} upload supir`}
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Pemakaian kuota</h2>
        <div className="mt-4">
          <UsageBar used={displayUsed} limit={displayLimit} label="UploadThing" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Proyeksi 12 bulan</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Estimasi pertumbuhan/tahun"
              value={formatBytes(proj.projectedYearlyBytes)}
            />
            <Row
              label="Perkiraan kuota habis"
              value={
                proj.monthsUntilLimit == null
                  ? "—"
                  : proj.monthsUntilLimit === 0
                    ? "Sudah melewati limit"
                    : `~${formatNumber(proj.monthsUntilLimit, 0)} bulan lagi`
              }
            />
            <Row
              label="Asumsi ukuran/foto"
              value={`${formatBytes(data.assumptions.avgPhotoBytes)} (maks upload ${formatBytes(data.assumptions.maxPhotoBytes)})`}
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Rekomendasi buffer</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            {proj.bufferRecommendation}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-neutral-600">
            <li>Arsip tahunan: export foto DO &gt;12 bulan ke Google Drive / S3, lalu hapus dari UploadThing.</li>
            <li>Upgrade UploadThing (~$10/bulan) bila operasi &gt;15 unit aktif setiap hari.</li>
            <li>Pantau halaman ini setiap awal bulan — angka aktual muncul setelah token production aktif.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Trend upload (estimasi)</h2>
        {db.monthlyTrend.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Belum ada upload supir.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                  <th className="pb-2 pr-4 font-medium">Bulan</th>
                  <th className="pb-2 pr-4 font-medium">Upload</th>
                  <th className="pb-2 pr-4 font-medium">Foto</th>
                  <th className="pb-2 font-medium">Estimasi</th>
                </tr>
              </thead>
              <tbody>
                {db.monthlyTrend.map((row) => (
                  <tr key={row.month} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">{formatMonthLabel(row.month)}</td>
                    <td className="py-2 pr-4">{formatNumber(row.submissions, 0)}</td>
                    <td className="py-2 pr-4">{formatNumber(row.photoCount, 0)}</td>
                    <td className="py-2">{formatBytes(row.estimatedBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        Total referensi foto di database: {formatNumber(db.totalPhotoRefs, 0)} dari{" "}
        {formatNumber(db.fieldSubmissionCount, 0)} submission. Estimasi memakai rata-rata{" "}
        {formatBytes(data.assumptions.avgPhotoBytes)}/foto — angka aktual dari UploadThing
        API menggantikan estimasi setelah production aktif.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{sub}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}
