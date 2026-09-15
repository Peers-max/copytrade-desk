import { MyStrategyClient } from "@/components/console/my-strategy-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { getStrategies, bootstrapIfNeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的策略" };

export default async function MyStrategyPage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;
  const strategies = await getStrategies();
  const subs = await filter<any>("strategySubs", (s) => s.userId === user.id);
  return <MyStrategyClient strategies={strategies} subs={subs} />;
}
