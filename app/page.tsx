import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lmsrPriceBinary, lmsrPriceCategorical } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

type OutcomeRow = {
  id: string;
  label: string;
  q_yes: number;
  q_no: number;
};

type MarketRow = {
  id: string;
  title: string;
  category: string;
  market_type: "binary" | "categorical" | "multi";
  liquidity_b: number;
  status: string;
  outcomes: OutcomeRow[];
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function marketPreview(market: MarketRow) {
  const b = Number(market.liquidity_b) || 100;
  const outcomes = market.outcomes ?? [];

  if (market.market_type === "binary") {
    const outcome = outcomes[0];
    if (!outcome) return "No outcomes configured";
    const yes = lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "yes");
    const no = lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "no");
    return `YES ${percent(yes)} | NO ${percent(no)}`;
  }

  if (market.market_type === "categorical") {
    if (outcomes.length === 0) return "No outcomes configured";
    const quantities = outcomes.map((outcome) => Number(outcome.q_yes));
    const priced = outcomes
      .map((outcome, index) => ({
        label: outcome.label,
        price: lmsrPriceCategorical(quantities, b, index),
      }))
      .sort((a, z) => z.price - a.price);

    const top = priced.slice(0, 2).map((item) => `${item.label} ${percent(item.price)}`);
    const remaining = priced.length - 2;
    return remaining > 0 ? `${top.join(" | ")} | +${remaining} more` : top.join(" | ");
  }

  const priced = outcomes.map((outcome) => ({
    label: outcome.label,
    yes: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "yes"),
  }));
  const top = priced.sort((a, z) => z.yes - a.yes)[0];
  if (!top) return "No outcomes configured";
  return `${outcomes.length} questions | Top: ${top.label} ${percent(top.yes)}`;
}

export default async function HomePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, title, category, market_type, liquidity_b, status, outcomes(id, label, q_yes, q_no)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const markets = (data ?? []) as MarketRow[];

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Open Markets</h1>
      </div>

      {markets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No open markets yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {markets.map((market) => (
            <Link href={`/markets/${market.id}`} key={market.id}>
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">{market.title}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{market.category}</Badge>
                    <Badge variant="outline">{market.market_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {marketPreview(market)}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
