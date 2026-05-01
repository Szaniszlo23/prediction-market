import { notFound, redirect } from "next/navigation";
import {
  BinaryPriceChart,
  CategoricalPriceChart,
  OutcomeMiniChart,
} from "@/components/markets/PriceCharts";
import { TradeDialog } from "@/components/markets/TradeDialog";
import { getCurrentUser } from "@/lib/auth";
import { lmsrPriceBinary, lmsrPriceCategorical } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type OutcomeRow = {
  id: string;
  label: string;
  sort_order: number;
  q_yes: number;
  q_no: number;
  resolution: "yes" | "no" | "invalid" | null;
};

type MarketRow = {
  id: string;
  title: string;
  description: string;
  market_type: "binary" | "categorical" | "multi";
  category: string;
  status: string;
  liquidity_b: number;
  fees_collected: number;
  resolves_at: string | null;
  outcomes: OutcomeRow[];
};

type TradeRow = {
  id: string;
  user_id: string;
  outcome_id: string;
  side: "yes" | "no";
  shares: number;
  total_cost: number;
  price_after: number;
  created_at: string;
};

type MarketDetailPageProps = {
  params: { id: string };
};

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}
function pctNum(v: number) {
  return Math.round(v * 100);
}
function asTime(v: string) {
  return new Date(v).toLocaleString();
}
function asChartTime(v: string) {
  return new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function asCurrency(v: number) {
  return `$${Number(v).toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
  resolved: "bg-blue-50 text-blue-700",
};

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = createClient();
  const { data: marketData } = await supabase
    .from("markets")
    .select(
      "id, title, description, market_type, category, status, liquidity_b, fees_collected, resolves_at, outcomes(id, label, sort_order, q_yes, q_no, resolution)",
    )
    .eq("id", params.id)
    .single();

  if (!marketData) notFound();

  const market = marketData as MarketRow;
  const outcomes = [...(market.outcomes ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const { data: tradesData } = await supabase
    .from("trades")
    .select("id, user_id, outcome_id, side, shares, total_cost, price_after, created_at")
    .eq("market_id", market.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const trades = (tradesData ?? []) as TradeRow[];

  const uniqueUserIds = Array.from(new Set(trades.map((t) => t.user_id)));
  const { data: profilesData } =
    uniqueUserIds.length > 0
      ? await supabase.from("profiles").select("id, username").in("id", uniqueUserIds)
      : { data: [] };
  const profileMap = new Map(
    ((profilesData ?? []) as { id: string; username: string | null }[]).map((p) => [
      p.id,
      p.username ?? "anonymous",
    ]),
  );
  const outcomeMap = new Map(outcomes.map((o) => [o.id, o]));

  const b = Number(market.liquidity_b) || 100;
  const pricedOutcomes = outcomes.map((outcome, index) => {
    if (market.market_type === "categorical") {
      const quantities = outcomes.map((item) => Number(item.q_yes));
      const price = lmsrPriceCategorical(quantities, b, index);
      return { ...outcome, yesPrice: price, noPrice: 1 - price };
    }
    return {
      ...outcome,
      yesPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "yes"),
      noPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "no"),
    };
  });

  const tradesAsc = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const binaryOutcome = pricedOutcomes[0];
  const binaryChartData = tradesAsc
    .filter((t) => t.outcome_id === binaryOutcome?.id)
    .map((t) => ({ time: asChartTime(t.created_at), price: Number(t.price_after) }));

  const categoricalChartData: { time: string; [key: string]: number | string | null }[] =
    market.market_type === "categorical"
      ? tradesAsc.map((t) => {
          const row: { time: string; [key: string]: number | string | null } = {
            time: asChartTime(t.created_at),
          };
          pricedOutcomes.forEach((o) => {
            row[o.label] = o.id === t.outcome_id ? Number(t.price_after) : null;
          });
          return row;
        })
      : [];

  const currentUser = await getCurrentUser();
  const { data: userPositionsData } = currentUser
    ? await supabase
        .from("positions")
        .select("outcome_id, yes_shares, no_shares")
        .eq("user_id", currentUser.id)
        .in("outcome_id", outcomes.map((o) => o.id))
    : { data: [] };
  const positionMap = new Map(
    ((userPositionsData ?? []) as { outcome_id: string; yes_shares: number; no_shares: number }[]).map(
      (p) => [p.outcome_id, p],
    ),
  );

  const marketInfo = { id: market.id, market_type: market.market_type, liquidity_b: b, status: market.status };
  const statusStyle = STATUS_STYLES[market.status] ?? STATUS_STYLES.closed;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 space-y-5">

      {/* ── Market header ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                {market.category}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                {market.status}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                {market.market_type}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{market.title}</h1>
            {market.description && (
              <p className="text-sm text-gray-500 leading-relaxed">{market.description}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-50 pt-4 text-xs text-gray-400">
          <span>Resolves: {market.resolves_at ? asTime(market.resolves_at) : "TBD"}</span>
          <span>Fees collected: {asCurrency(Number(market.fees_collected))}</span>
        </div>
      </div>

      {/* ── BINARY ── */}
      {market.market_type === "binary" && binaryOutcome ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          {/* Prices */}
          <div className="flex items-center gap-4">
            <div className="flex-1 rounded-xl bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{pct(binaryOutcome.yesPrice)}</p>
              <p className="mt-0.5 text-xs font-medium text-green-500 uppercase tracking-wide">Yes</p>
            </div>
            <div className="flex-1 rounded-xl bg-red-50 p-4 text-center">
              <p className="text-3xl font-bold text-red-500">{pct(binaryOutcome.noPrice)}</p>
              <p className="mt-0.5 text-xs font-medium text-red-400 uppercase tracking-wide">No</p>
            </div>
          </div>

          {/* Probability bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-red-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${pctNum(binaryOutcome.yesPrice)}%` }}
            />
          </div>

          {/* Trade buttons */}
          <div className="grid grid-cols-2 gap-3">
            <TradeDialog allOutcomes={outcomes} market={marketInfo} outcome={binaryOutcome} defaultSide="yes" currentPrice={binaryOutcome.yesPrice} />
            <TradeDialog allOutcomes={outcomes} market={marketInfo} outcome={binaryOutcome} defaultSide="no" currentPrice={binaryOutcome.noPrice} />
          </div>

          {/* Position */}
          {currentUser && (() => {
            const pos = positionMap.get(binaryOutcome.id);
            const yes = Number(pos?.yes_shares ?? 0);
            const no = Number(pos?.no_shares ?? 0);
            if (!pos || (yes === 0 && no === 0)) return null;
            return (
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                <span className="text-gray-500">Your position — </span>
                <span className="font-semibold text-green-600">{yes} YES</span>
                <span className="mx-2 text-gray-300">·</span>
                <span className="font-semibold text-red-500">{no} NO</span>
              </div>
            );
          })()}

          {/* Chart */}
          {binaryChartData.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Price History</p>
              <BinaryPriceChart data={binaryChartData} />
            </div>
          )}
        </div>
      ) : null}

      {/* ── CATEGORICAL ── */}
      {market.market_type === "categorical" ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Outcomes</p>

          {/* Stacked bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {pricedOutcomes.map((o, i) => {
              const colors = ["bg-blue-400", "bg-purple-400", "bg-orange-400", "bg-teal-400", "bg-pink-400"];
              return (
                <div
                  key={o.id}
                  className={colors[i % colors.length]}
                  style={{ width: `${Math.max(pctNum(o.yesPrice), 1)}%` }}
                  title={`${o.label} ${pct(o.yesPrice)}`}
                />
              );
            })}
          </div>

          {/* Outcome rows */}
          <div className="space-y-2">
            {[...pricedOutcomes].sort((a, z) => z.yesPrice - a.yesPrice).map((outcome) => {
              const outcomeTrades = trades.filter((t) => t.outcome_id === outcome.id);
              const last = outcomeTrades[0];
              const prev = outcomeTrades[1];
              const delta = last && prev ? (Number(last.price_after) - Number(prev.price_after)) * 100 : 0;

              return (
                <div
                  key={outcome.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{outcome.label}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{pct(outcome.yesPrice)}</span>
                      {delta !== 0 && (
                        <span className={`text-xs ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {currentUser && positionMap.has(outcome.id) && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {Number(positionMap.get(outcome.id)?.yes_shares ?? 0)} shares held
                      </p>
                    )}
                  </div>
                  {/* Bar */}
                  <div className="hidden sm:block w-24">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${pctNum(outcome.yesPrice)}%` }} />
                    </div>
                  </div>
                  <TradeDialog allOutcomes={outcomes} market={marketInfo} outcome={outcome} defaultSide="yes" currentPrice={outcome.yesPrice} triggerLabel="Trade" />
                </div>
              );
            })}
          </div>

          {categoricalChartData.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Price History</p>
              <CategoricalPriceChart
                data={categoricalChartData}
                outcomeLabels={pricedOutcomes.map((o) => o.label)}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* ── MULTI ── */}
      {market.market_type === "multi" ? (
        <div className="space-y-3">
          {pricedOutcomes.map((outcome) => {
            const outcomeChartData = tradesAsc
              .filter((t) => t.outcome_id === outcome.id)
              .map((t) => ({ time: asChartTime(t.created_at), price: Number(t.price_after) }));
            const pos = positionMap.get(outcome.id);

            return (
              <div key={outcome.id} className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{outcome.label}</p>
                    {outcome.resolution && (
                      <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {outcome.resolution}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-bold text-green-600">{pct(outcome.yesPrice)}</span>
                    <span className="ml-1 text-xs text-green-500">YES</span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${pctNum(outcome.yesPrice)}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <TradeDialog allOutcomes={outcomes} market={marketInfo} outcome={outcome} defaultSide="yes" currentPrice={outcome.yesPrice} />
                  <TradeDialog allOutcomes={outcomes} market={marketInfo} outcome={outcome} defaultSide="no" currentPrice={outcome.noPrice} />
                </div>

                {currentUser && pos && (Number(pos.yes_shares) > 0 || Number(pos.no_shares) > 0) && (
                  <p className="text-xs text-gray-400">
                    Position: <span className="font-medium text-green-600">{Number(pos.yes_shares)} YES</span>
                    {" · "}
                    <span className="font-medium text-red-500">{Number(pos.no_shares)} NO</span>
                  </p>
                )}

                {outcomeChartData.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                      Show chart
                    </summary>
                    <div className="pt-3">
                      <OutcomeMiniChart data={outcomeChartData} />
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Recent Trades ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Recent Trades</p>
        {trades.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No trades yet. Be the first!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400">Time</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400">User</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400">Action</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400">Shares</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400">Cost</th>
                  <th className="pb-2 text-xs font-medium text-gray-400">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trades.map((trade) => {
                  const outcomeLabel = outcomeMap.get(trade.outcome_id)?.label ?? "Outcome";
                  const isYes = trade.side === "yes";
                  return (
                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-4 text-gray-400">{asTime(trade.created_at)}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-700">{profileMap.get(trade.user_id) ?? "anon"}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isYes ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {trade.side.toUpperCase()}
                        </span>
                        <span className="ml-2 text-gray-500">{outcomeLabel}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{Number(trade.shares)}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{asCurrency(Number(trade.total_cost))}</td>
                      <td className="py-2.5 text-gray-600">{pct(Number(trade.price_after))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
