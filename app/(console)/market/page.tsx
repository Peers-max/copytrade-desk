import { MarketClient } from "@/components/console/market-client";
import { buildMarket } from "@/lib/market";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时行情" };

export default function MarketPage() {
  return <MarketClient initial={buildMarket()} />;
}
