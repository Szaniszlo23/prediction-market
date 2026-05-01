import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BinaryPriceChart,
  CategoricalPriceChart,
  OutcomeMiniChart,
} from "@/components/markets/PriceCharts";
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

function asPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function asTime(value: string) {
  return new Date(value).toLocaleString();
}

function asChartTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function asCurrency(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

function tradeDescription(
  trade: TradeRow,
  marketType: MarketRow["market_type"],
  outcomeLabel: string,
): string {
  const side = trade.side.toUpperCase();
  if (marketType === "categorical") {
    return `Bought ${trade.shares} ${side} on ${outcomeLabel}`;
  }
  return `Bought ${trade.shares} ${side} on ${outcomeLabel}`;
}

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = createClient();
  const { data: marketData } = await supabase
    .from("markets")
    .select(
      "id, title, description, market_type, category, status, liquidity_b, fees_collected, resolves_at, outcomes(id, label, sort_order, q_yes, q_no, resolution)",
    )
    .eq("id", params.id)
    .single();

  if (!marketData) {
    notFound();
  }

  const market = marketData as MarketRow;
  const outcomes = [...(market.outcomes ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const { data: tradesData } = await supabase
    .from("trades")
    .select("id, user_id, outcome_id, side, shares, total_cost, price_after, created_at")
    .eq("market_id", market.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const trades = (tradesData ?? []) as TradeRow[];

  const uniqueUserIds = Array.from(new Set(trades.map((trade) => trade.user_id)));
  const { data: profilesData } =
    uniqueUserIds.length > 0
      ? await supabase.from("profiles").select("id, username").in("id", uniqueUserIds)
      : { data: [] };
  const profileMap = new Map(
    ((profilesData ?? []) as { id: string; username: string | null }[]).map((item) => [
      item.id,
      item.username ?? "anonymous",
    ]),
  );
  const outcomeMap = new Map(outcomes.map((outcome) => [outcome.id, outcome]));

  const b = Number(market.liquidity_b) || 100;
  const pricedOutcomes = outcomes.map((outcome, index) => {
    if (market.market_type === "categorical") {
      const quantities = outcomes.map((item) => Number(item.q_yes));
      return {
        ...outcome,
        yesPrice: lmsrPriceCategorical(quantities, b, index),
        noPrice: 1 - lmsrPriceCategorical(quantities, b, index),
      };
    }

    return {
      ...outcome,
      yesPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "yes"),
      noPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "no"),
    };
  });

  const tradesAsc = [...trades].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );

  const binaryOutcome = pricedOutcomes[0];
  const binaryChartData = tradesAsc
    .filter((trade) => trade.outcome_id === binaryOutcome?.id)
    .map((trade) => ({
      time: asChartTime(trade.created_at),
      price: Number(trade.price_after),
    }));

  const categoricalChartData: { time: string; [key: string]: number | string | null }[] =
    market.market_type === "categorical"
      ? tradesAsc.map((trade) => {
          const row: { time: string; [key: string]: number | string | null } = {
            time: asChartTime(trade.created_at),
          };
          pricedOutcomes.forEach((outcome) => {
            row[outcome.label] = outcome.id === trade.outcome_id ? Number(trade.price_after) : null;
          });
          return row;
        })
      : [];

  const currentUser = await getCurrentUser();
  const yourPosition =
    currentUser && binaryOutcome
      ? await supabase
          .from("positions")
          .select("yes_shares, no_shares")
          .eq("user_id", currentUser.id)
          .eq("outcome_id", binaryOutcome.id)
          .maybeSingle()
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{market.title}</CardTitle>
            <Badge variant="outline">{market.market_type}</Badge>
            <Badge variant="outline">{market.status}</Badge>
          </div>
          <CardDescription>{market.description}</CardDescription>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Resolves at: {market.resolves_at ? asTime(market.resolves_at) : "Not set"}</span>
            <span>Fees collected: {asCurrency(Number(market.fees_collected))}</span>
          </div>
        </CardHeader>
      </Card>

      {market.market_type === "binary" && binaryOutcome ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{binaryOutcome.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">YES</p>
                  <p className="text-4xl font-bold text-green-600">{asPercent(binaryOutcome.yesPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">NO</p>
                  <p className="text-4xl font-bold text-red-600">{asPercent(binaryOutcome.noPrice)}</p>
                </div>
              </div>
              <Card className="border-dashed">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Trading available after next implementation step.
                </CardContent>
              </Card>
              {currentUser ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Your Position</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    YES shares: {Number(yourPosition?.data?.yes_shares ?? 0)} | NO shares:{" "}
                    {Number(yourPosition?.data?.no_shares ?? 0)}
                  </CardContent>
                </Card>
              ) : null}
              <BinaryPriceChart data={binaryChartData} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {market.market_type === "categorical" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Outcome Probabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-6 w-full overflow-hidden rounded-md border">
                {pricedOutcomes.map((outcome) => (
                  <div
                    className="bg-primary/80"
                    key={outcome.id}
                    style={{ width: `${Math.max(outcome.yesPrice * 100, 2)}%` }}
                    title={`${outcome.label} ${asPercent(outcome.yesPrice)}`}
                  />
                ))}
              </div>
              <div className="grid gap-3">
                {pricedOutcomes
                  .sort((a, z) => z.yesPrice - a.yesPrice)
                  .map((outcome) => {
                    const outcomeTrades = trades
                      .filter((trade) => trade.outcome_id === outcome.id)
                      .sort(
                        (left, right) =>
                          new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
                      );
                    const last = outcomeTrades.at(-1);
                    const prev = outcomeTrades.at(-2);
                    const delta =
                      last && prev ? (Number(last.price_after) - Number(prev.price_after)) * 100 : 0;

                    return (
                      <Card key={outcome.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium">{outcome.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {asPercent(outcome.yesPrice)}{" "}
                              <span className={delta >= 0 ? "text-green-600" : "text-red-600"}>
                                {delta >= 0 ? "+" : ""}
                                {delta.toFixed(1)}%
                              </span>
                            </p>
                          </div>
                          <Button size="sm">Trade</Button>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
              <Card className="border-dashed">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Trading available after next implementation step.
                </CardContent>
              </Card>
              <CategoricalPriceChart
                data={categoricalChartData}
                outcomeLabels={pricedOutcomes.map((outcome) => outcome.label)}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {market.market_type === "multi" ? (
        <div className="space-y-4">
          {pricedOutcomes.map((outcome) => {
            const outcomeChartData = tradesAsc
              .filter((trade) => trade.outcome_id === outcome.id)
              .map((trade) => ({
                time: asChartTime(trade.created_at),
                price: Number(trade.price_after),
              }));

            return (
              <Card key={outcome.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{outcome.label}</p>
                    {outcome.resolution ? <Badge variant="outline">{outcome.resolution}</Badge> : null}
                  </div>
                  <div className="text-sm">
                    YES <span className="font-semibold text-green-600">{asPercent(outcome.yesPrice)}</span> | NO{" "}
                    <span className="font-semibold text-red-600">{asPercent(outcome.noPrice)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm">Buy YES</Button>
                    <Button size="sm" variant="outline">
                      Buy NO
                    </Button>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Show mini chart
                    </summary>
                    <div className="pt-3">
                      <OutcomeMiniChart data={outcomeChartData} />
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Trading available after next implementation step.
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Time</th>
                    <th className="p-2">User</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Shares</th>
                    <th className="p-2">Total Cost</th>
                    <th className="p-2">Price After</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => {
                    const outcomeLabel = outcomeMap.get(trade.outcome_id)?.label ?? "Outcome";
                    return (
                      <tr className="border-b" key={trade.id}>
                        <td className="p-2">{asTime(trade.created_at)}</td>
                        <td className="p-2">{profileMap.get(trade.user_id) ?? "anonymous"}</td>
                        <td className="p-2">
                          {tradeDescription(trade, market.market_type, outcomeLabel)}
                        </td>
                        <td className="p-2">{Number(trade.shares)}</td>
                        <td className="p-2">{asCurrency(Number(trade.total_cost))}</td>
                        <td className="p-2">{asPercent(Number(trade.price_after))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
