import { ApiKeysClient } from "@/components/console/api-keys-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { EXCHANGES, bootstrapIfNeeded } from "@/lib/seed";
import type { ApiKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "API 管理" };

export default async function ApiKeysPage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;
  const keys = await filter<ApiKey>("apiKeys", (k) => k.userId === user.id);
  return <ApiKeysClient keys={keys} exchanges={EXCHANGES} />;
}
