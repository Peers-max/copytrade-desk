import { CopyTradingClient } from "@/components/console/copy-trading-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { getTraders, seedIfNeeded } from "@/lib/seed";
import type { CopyRelation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "跟单交易" };

export default async function CopyTradingPage() {
  seedIfNeeded();
  const user = (await getSessionUser())!;
  const traders = await getTraders();
  const relations = await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id);
  return <CopyTradingClient traders={traders} relations={relations} />;
}
