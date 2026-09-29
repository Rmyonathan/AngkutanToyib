import { UTApi } from "uploadthing/server";
import { prisma } from "@/lib/prisma";
import { isUploadThingConfigured } from "@/lib/upload/config";

/** Conservative average for compressed phone photos (Surat Jalan / nota). */
export const AVG_PHOTO_BYTES = Math.round(1.5 * 1024 * 1024);
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const FREE_TIER_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

export type MonthlyPhotoTrend = {
  month: string;
  submissions: number;
  photoCount: number;
  estimatedBytes: number;
};

export type StorageOverview = {
  uploadThing: {
    configured: boolean;
    totalBytes: number | null;
    limitBytes: number | null;
    filesUploaded: number | null;
    error: string | null;
  };
  database: {
    totalPhotoRefs: number;
    fieldSubmissionCount: number;
    photosThisMonth: number;
    photosLastMonth: number;
    estimatedBytes: number;
    monthlyTrend: MonthlyPhotoTrend[];
  };
  projections: {
    avgPhotosPerMonth: number;
    avgSubmissionsPerMonth: number;
    projectedYearlyBytes: number;
    monthsUntilLimit: number | null;
    bufferRecommendation: string;
  };
  assumptions: {
    avgPhotoBytes: number;
    maxPhotoBytes: number;
    freeTierLimitBytes: number;
  };
};

function countPhotos(row: {
  suratJalanPhoto: string | null;
  solarPhoto?: string | null;
  otherPhoto?: string | null;
}): number {
  let n = 0;
  if (row.suratJalanPhoto) n += 1;
  if (row.solarPhoto) n += 1;
  if (row.otherPhoto) n += 1;
  return n;
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export async function getStorageOverview(): Promise<StorageOverview> {
  const configured = isUploadThingConfigured();

  let uploadThingUsage: StorageOverview["uploadThing"] = {
    configured,
    totalBytes: null,
    limitBytes: null,
    filesUploaded: null,
    error: null,
  };

  if (configured) {
    try {
      const utapi = new UTApi();
      const usage = await utapi.getUsageInfo();
      uploadThingUsage = {
        configured: true,
        totalBytes: usage.totalBytes,
        limitBytes: usage.limitBytes,
        filesUploaded: usage.filesUploaded,
        error: null,
      };
    } catch (e) {
      uploadThingUsage.error =
        e instanceof Error ? e.message : "Gagal mengambil data UploadThing";
    }
  }

  const submissions = await prisma.fieldSubmission.findMany({
    select: {
      suratJalanPhoto: true,
      solarPhoto: true,
      otherPhoto: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  const monthMap = new Map<string, MonthlyPhotoTrend>();
  let totalPhotoRefs = 0;
  let photosThisMonth = 0;
  let photosLastMonth = 0;

  for (const row of submissions) {
    const photos = countPhotos(row);
    totalPhotoRefs += photos;

    const mk = monthKey(row.createdAt);
    const bucket = monthMap.get(mk) ?? {
      month: mk,
      submissions: 0,
      photoCount: 0,
      estimatedBytes: 0,
    };
    bucket.submissions += 1;
    bucket.photoCount += photos;
    bucket.estimatedBytes += photos * AVG_PHOTO_BYTES;
    monthMap.set(mk, bucket);

    if (mk === thisMonth) photosThisMonth += photos;
    if (mk === lastMonth) photosLastMonth += photos;
  }

  const monthlyTrend = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const estimatedBytes = totalPhotoRefs * AVG_PHOTO_BYTES;

  const recentMonths = monthlyTrend.slice(-6);
  const avgPhotosPerMonth =
    recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.photoCount, 0) / recentMonths.length
      : photosThisMonth;
  const avgSubmissionsPerMonth =
    recentMonths.length > 0
      ? recentMonths.reduce((s, m) => s + m.submissions, 0) /
        recentMonths.length
      : submissions.filter((s) => monthKey(s.createdAt) === thisMonth).length;

  const projectedYearlyBytes = Math.round(avgPhotosPerMonth * 12 * AVG_PHOTO_BYTES);

  const usedBytes =
    uploadThingUsage.totalBytes ?? estimatedBytes;
  const limitBytes =
    uploadThingUsage.limitBytes ?? FREE_TIER_LIMIT_BYTES;
  const monthlyGrowth = avgPhotosPerMonth * AVG_PHOTO_BYTES;

  let monthsUntilLimit: number | null = null;
  if (monthlyGrowth > 0 && limitBytes > usedBytes) {
    monthsUntilLimit = Math.floor((limitBytes - usedBytes) / monthlyGrowth);
  } else if (limitBytes > 0 && usedBytes >= limitBytes) {
    monthsUntilLimit = 0;
  }

  let bufferRecommendation: string;
  if (!configured) {
    bufferRecommendation =
      "UploadThing belum dikonfigurasi. Set UPLOADTHING_TOKEN di Railway sebelum go-live.";
  } else if (monthsUntilLimit === null) {
    bufferRecommendation =
      "Belum cukup data operasional untuk proyeksi. Pantau lagi setelah 1–2 bulan upload supir.";
  } else if (monthsUntilLimit >= 18) {
    bufferRecommendation =
      "Free tier 2 GB cukup untuk setidaknya ~1,5 tahun pada ritme saat ini. Review setiap awal tahun.";
  } else if (monthsUntilLimit >= 6) {
    bufferRecommendation =
      "Perkiraan kuota habis dalam beberapa bulan. Siapkan upgrade UploadThing atau arsip tahunan sebelum limit.";
  } else {
    bufferRecommendation =
      "Ritme upload tinggi — pertimbangkan paket berbayar UploadThing atau arsip foto DO >12 bulan ke cold storage.";
  }

  return {
    uploadThing: uploadThingUsage,
    database: {
      totalPhotoRefs,
      fieldSubmissionCount: submissions.length,
      photosThisMonth,
      photosLastMonth,
      estimatedBytes,
      monthlyTrend,
    },
    projections: {
      avgPhotosPerMonth,
      avgSubmissionsPerMonth,
      projectedYearlyBytes,
      monthsUntilLimit,
      bufferRecommendation,
    },
    assumptions: {
      avgPhotoBytes: AVG_PHOTO_BYTES,
      maxPhotoBytes: MAX_PHOTO_BYTES,
      freeTierLimitBytes: FREE_TIER_LIMIT_BYTES,
    },
  };
}
