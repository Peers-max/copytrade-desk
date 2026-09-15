import { StrategiesClient } from "@/components/console/strategies-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { getStrategies, bootstrapIfNeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata = { title: "策略市场" };

export default async function StrategiesPage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;
  const strategies = await getStrategies();
  const subs = (await filter<any>("strategySubs", (s) => s.userId === user.id)).map((s) => s.strategyId);
  return <StrategiesClient strategies={strategies} subscribed={subs} />;
}
