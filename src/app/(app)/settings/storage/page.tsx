import { StorageOverviewClient } from "@/components/settings/storage-overview-client";
import { getStorageOverview } from "@/lib/storage/get-storage-overview";

export const dynamic = "force-dynamic";

export default async function StorageSettingsPage() {
  const data = await getStorageOverview();
  return <StorageOverviewClient data={data} />;
}
