import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { lmsrPriceBinary, lmsrPriceCategorical } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SellDialog } from "@/components/markets/SellDialog";

type MarketInfo = {
  id: string;
  title: string;
  market_type: "binary" | "categorical" | "multi";
  liquidity_b: number;
  status: string;
  category: string;
};

type OutcomeInfo = {
  id: string;
  label: string;
  sort_order: number;
  q_yes: number;
  q_no: number;
  resolution: "yes" | "no" | "invalid" | null;
  market_id: string;
  markets: MarketInfo;
};

type PositionRow = {
  outcome_id: string;
  yes_shares: number;
  no_shares: number;
  outcomes: OutcomeInfo;
};

type TradeRow = {
  outcome_id: string;
  side: "yes" | "no";
  total_cost: number;
};

type SiblingOutcome = {
  id: string;
  label: string;
  q_yes: number;
  q_no: number;
  sort_order: number;
};

type PositionEntry = {
  market: MarketInfo;
  outcomeId: string;
  outcomeLabel: string;
  outcomeQYes: number;
  outcomeQNo: number;
  outcomeSortOrder: number;
  allSiblings: SiblingOutcome[];
  resolution: "yes" | "no" | "invalid" | null;
  yesShares: number;
  noShares: number;
  yesPrice: number;
  noPrice: number;
  yesCost: number;
  noCost: number;
  yesValue: number;
  noValue: number;
};

function fmt(v: number) {
  return `$${v.toFixed(2)}`;
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function pnlColor(pnl: number) {
  if (pnl > 0) return "text-green-600";
  if (pnl < 0) return "text-red-500";
  return "text-gray-400";
}

function pnlBg(pnl: number) {
  if (pnl > 0) return "bg-green-50 text-green-700";
  if (pnl < 0) return "bg-red-50 text-red-600";
  return "bg-gray-50 text-gray-500";
}

const CATEGORY_COLORS: Record<string, string> = {
  Sports: "bg-blue-50 text-blue-600",
  Politics: "bg-purple-50 text-purple-600",
  Crypto: "bg-orange-50 text-orange-600",
  Academic: "bg-teal-50 text-teal-600",
  Other: "bg-gray-100 text-gray-500",
};

export default async function PortfolioPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  // Load balance
  const { data: profileData } = await supabase
    .from("profiles")
    .select("balance, username")
    .eq("id", user.id)
    .single();
  const balance = Number(profileData?.balance ?? 0);
  const username = profileData?.username ?? user.email?.split("@")[0] ?? "You";

  // Load all non-zero positions with outcome + market data
  const { data: positionsRaw } = await supabase
    .from("positions")
    .select(
      "outcome_id, yes_shares, no_shares, outcomes(id, label, sort_order, q_yes, q_no, resolution, market_id, markets(id, title, market_type, liquidity_b, status, category))",
    )
    .eq("user_id", user.id);

  const positions = ((positionsRaw ?? []) as unknown as PositionRow[]).filter(
    (p) => Number(p.yes_shares) > 0 || Number(p.no_shares) > 0,
  );

  // Load all trades for cost basis
  const outcomeIds = positions.map((p) => p.outcome_id);
  const { data: tradesRaw } =
    outcomeIds.length > 0
      ? await supabase
          .from("trades")
          .select("outcome_id, side, total_cost")
          .eq("user_id", user.id)
          .in("outcome_id", outcomeIds)
      : { data: [] };
  const trades = (tradesRaw ?? []) as TradeRow[];

  // Build cost map: outcomeId → { yes: number, no: number }
  const costMap = new Map<string, { yes: number; no: number }>();
  for (const t of trades) {
    const entry = costMap.get(t.outcome_id) ?? { yes: 0, no: 0 };
    entry[t.side] += Number(t.total_cost);
    costMap.set(t.outcome_id, entry);
  }

  // For categorical pricing we need all outcomes per market
  const marketIds = Array.from(new Set(positions.map((p) => p.outcomes.market_id)));
  const { data: allOutcomesRaw } =
    marketIds.length > 0
      ? await supabase
          .from("outcomes")
          .select("id, label, q_yes, q_no, sort_order, market_id")
          .in("market_id", marketIds)
      : { data: [] };
  const allOutcomesFlat = (allOutcomesRaw ?? []) as (SiblingOutcome & { market_id: string })[];

  // marketId → sorted sibling outcomes
  const marketOutcomeMap = new Map<string, SiblingOutcome[]>();
  for (const o of allOutcomesFlat) {
    const list = marketOutcomeMap.get(o.market_id) ?? [];
    list.push(o);
    marketOutcomeMap.set(o.market_id, list);
  }

  // Build enriched position entries
  const entries: PositionEntry[] = positions.map((p) => {
    const o = p.outcomes;
    const market = o.markets;
    const b = Number(market.liquidity_b) || 100;
    const yesShares = Number(p.yes_shares);
    const noShares = Number(p.no_shares);
    const cost = costMap.get(p.outcome_id) ?? { yes: 0, no: 0 };
    const siblings = (marketOutcomeMap.get(o.market_id) ?? []).sort(
      (a, z) => a.sort_order - z.sort_order,
    );

    let yesPrice: number;
    let noPrice: number;

    if (o.resolution === "yes") {
      yesPrice = 1; noPrice = 0;
    } else if (o.resolution === "no") {
      yesPrice = 0; noPrice = 1;
    } else if (o.resolution === "invalid") {
      yesPrice = 0; noPrice = 0;
    } else if (market.market_type === "categorical") {
      const quantities = siblings.map((s) => Number(s.q_yes));
      const idx = siblings.findIndex((s) => s.id === o.id);
      yesPrice = idx >= 0 ? lmsrPriceCategorical(quantities, b, idx) : 0.5;
      noPrice = 1 - yesPrice;
    } else {
      yesPrice = lmsrPriceBinary(Number(o.q_yes), Number(o.q_no), b, "yes");
      noPrice = lmsrPriceBinary(Number(o.q_yes), Number(o.q_no), b, "no");
    }

    const yesValue = yesShares * yesPrice;
    const noValue = noShares * noPrice;

    return {
      market,
      outcomeId: o.id,
      outcomeLabel: o.label,
      outcomeQYes: Number(o.q_yes),
      outcomeQNo: Number(o.q_no),
      outcomeSortOrder: o.sort_order,
      allSiblings: siblings,
      resolution: o.resolution,
      yesShares,
      noShares,
      yesPrice,
      noPrice,
      yesCost: cost.yes,
      noCost: cost.no,
      yesValue,
      noValue,
    };
  });

  // Group by market
  const byMarket = new Map<string, PositionEntry[]>();
  for (const e of entries) {
    const list = byMarket.get(e.market.id) ?? [];
    list.push(e);
    byMarket.set(e.market.id, list);
  }

  // Summary stats
  const totalInvested = entries.reduce((s, e) => s + e.yesCost + e.noCost, 0);
  const totalValue = entries.reduce((s, e) => s + e.yesValue + e.noValue, 0);
  const totalPnL = totalValue - totalInvested;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Portfolio</h1>
          <p className="mt-0.5 text-sm text-gray-500">{username}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-3 text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Cash balance</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(balance)}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Invested</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{fmt(totalInvested)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Current Value</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{fmt(totalValue)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${totalPnL > 0 ? "border-green-100 bg-green-50" : totalPnL < 0 ? "border-red-100 bg-red-50" : "border-gray-100 bg-white"}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">P&amp;L</p>
          <div className="mt-1 flex items-center gap-1.5">
            {totalPnL > 0 ? (
              <TrendingUp className="size-4 text-green-600" />
            ) : totalPnL < 0 ? (
              <TrendingDown className="size-4 text-red-500" />
            ) : (
              <Minus className="size-4 text-gray-400" />
            )}
            <p className={`text-xl font-bold ${pnlColor(totalPnL)}`}>
              {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
            </p>
          </div>
        </div>
      </div>

      {/* Positions */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">No positions yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-gray-700 underline underline-offset-2"
          >
            Browse markets →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(byMarket.entries()).map(([marketId, marketEntries]) => {
            const market = marketEntries[0].market;
            const marketInvested = marketEntries.reduce((s, e) => s + e.yesCost + e.noCost, 0);
            const marketValue = marketEntries.reduce((s, e) => s + e.yesValue + e.noValue, 0);
            const marketPnL = marketValue - marketInvested;
            const catColor = CATEGORY_COLORS[market.category] ?? CATEGORY_COLORS.Other;
            const isResolved = market.status === "resolved";

            return (
              <div key={marketId} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                {/* Market header */}
                <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catColor}`}>
                        {market.category}
                      </span>
                      {isResolved && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                          Resolved
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/markets/${marketId}`}
                      className="mt-1 block font-semibold text-gray-900 hover:text-black hover:underline underline-offset-2"
                    >
                      {market.title}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">Market P&amp;L</p>
                    <p className={`text-base font-bold ${pnlColor(marketPnL)}`}>
                      {marketPnL >= 0 ? "+" : ""}{fmt(marketPnL)}
                    </p>
                  </div>
                </div>

                {/* Position rows */}
                <div className="divide-y divide-gray-50">
                  {marketEntries.map((entry) => {
                    const totalCost = entry.yesCost + entry.noCost;
                    const totalVal = entry.yesValue + entry.noValue;
                    const pnl = totalVal - totalCost;

                    return (
                      <div key={entry.outcomeId} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-800 truncate">{entry.outcomeLabel}</p>
                            {entry.resolution && (
                              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                entry.resolution === "yes" ? "bg-green-100 text-green-700" :
                                entry.resolution === "no" ? "bg-red-50 text-red-600" :
                                "bg-amber-50 text-amber-600"
                              }`}>
                                {entry.resolution === "yes" ? "🏆 Won" : entry.resolution === "no" ? "✗ Lost" : "⚠️ Invalid"}
                              </span>
                            )}
                          </div>
                          <div className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${pnlBg(pnl)}`}>
                            {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {entry.yesShares > 0 && (
                            <div className="rounded-xl bg-green-50 p-3 flex flex-col gap-2">
                              <div>
                                <p className="text-xs text-green-500 font-medium uppercase tracking-wide">YES</p>
                                <p className="mt-0.5 text-lg font-bold text-green-700">{entry.yesShares}</p>
                                <p className="text-xs text-green-500">@ {pct(entry.yesPrice)}</p>
                              </div>
                              {!entry.resolution && market.status === "open" && (
                                <SellDialog
                                  outcome={{ id: entry.outcomeId, label: entry.outcomeLabel, q_yes: entry.outcomeQYes, q_no: entry.outcomeQNo, sort_order: entry.outcomeSortOrder }}
                                  market={{ id: market.id, market_type: market.market_type, liquidity_b: market.liquidity_b }}
                                  allOutcomes={entry.allSiblings}
                                  side="yes"
                                  sharesHeld={entry.yesShares}
                                />
                              )}
                            </div>
                          )}
                          {entry.noShares > 0 && (
                            <div className="rounded-xl bg-red-50 p-3 flex flex-col gap-2">
                              <div>
                                <p className="text-xs text-red-400 font-medium uppercase tracking-wide">NO</p>
                                <p className="mt-0.5 text-lg font-bold text-red-600">{entry.noShares}</p>
                                <p className="text-xs text-red-400">@ {pct(entry.noPrice)}</p>
                              </div>
                              {!entry.resolution && market.status === "open" && (
                                <SellDialog
                                  outcome={{ id: entry.outcomeId, label: entry.outcomeLabel, q_yes: entry.outcomeQYes, q_no: entry.outcomeQNo, sort_order: entry.outcomeSortOrder }}
                                  market={{ id: market.id, market_type: market.market_type, liquidity_b: market.liquidity_b }}
                                  allOutcomes={entry.allSiblings}
                                  side="no"
                                  sharesHeld={entry.noShares}
                                />
                              )}
                            </div>
                          )}
                          <div className="rounded-xl bg-gray-50 p-3">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Value</p>
                            <p className="mt-0.5 text-lg font-bold text-gray-800">{fmt(totalVal)}</p>
                            <p className="text-xs text-gray-400">cost {fmt(totalCost)}</p>
                          </div>
                          <div className={`rounded-xl p-3 ${pnlBg(pnl)}`}>
                            <p className="text-xs font-medium uppercase tracking-wide opacity-70">P&amp;L</p>
                            <p className="mt-0.5 text-lg font-bold">{pnl >= 0 ? "+" : ""}{fmt(pnl)}</p>
                            <p className="text-xs opacity-60">
                              {totalCost > 0 ? `${((pnl / totalCost) * 100).toFixed(1)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
