import { WalletClient } from "@/components/console/wallet-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { PLANS, seedIfNeeded } from "@/lib/seed";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "钱包订阅" };

export default async function WalletPage() {
  seedIfNeeded();
  const user = (await getSessionUser())!;
  const invoices = (await filter<Invoice>("invoices", (i) => i.userId === user.id)).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <WalletClient
      plans={PLANS}
      currentPlanId={user.planId}
      expiresAt={user.planExpiresAt}
      balance={user.balance}
      invoices={invoices}
    />
  );
}
