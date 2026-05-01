import Link from "next/link";
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

type BinaryPreview = { type: "binary"; yes: number; no: number };
type CategoricalPreview = { type: "categorical"; items: { label: string; price: number }[] };
type MultiPreview = { type: "multi"; count: number; top: { label: string; yes: number } | null };

function getPreview(market: MarketRow): BinaryPreview | CategoricalPreview | MultiPreview {
  const b = Number(market.liquidity_b) || 100;
  const outcomes = market.outcomes ?? [];

  if (market.market_type === "binary") {
    const o = outcomes[0];
    if (!o) return { type: "binary", yes: 0.5, no: 0.5 };
    return {
      type: "binary",
      yes: lmsrPriceBinary(Number(o.q_yes), Number(o.q_no), b, "yes"),
      no: lmsrPriceBinary(Number(o.q_yes), Number(o.q_no), b, "no"),
    };
  }

  if (market.market_type === "categorical") {
    const quantities = outcomes.map((o) => Number(o.q_yes));
    const items = outcomes
      .map((o, i) => ({ label: o.label, price: lmsrPriceCategorical(quantities, b, i) }))
      .sort((a, z) => z.price - a.price)
      .slice(0, 3);
    return { type: "categorical", items };
  }

  const top = outcomes
    .map((o) => ({ label: o.label, yes: lmsrPriceBinary(Number(o.q_yes), Number(o.q_no), b, "yes") }))
    .sort((a, z) => z.yes - a.yes)[0] ?? null;
  return { type: "multi", count: outcomes.length, top };
}

function pct(v: number) {
  return Math.round(v * 100);
}

const CATEGORY_COLORS: Record<string, string> = {
  Sports: "bg-blue-50 text-blue-600",
  Politics: "bg-purple-50 text-purple-600",
  Crypto: "bg-orange-50 text-orange-600",
  Academic: "bg-teal-50 text-teal-600",
  Other: "bg-gray-100 text-gray-500",
};

export default async function HomePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, title, category, market_type, liquidity_b, status, outcomes(id, label, q_yes, q_no)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const markets = (data ?? []) as MarketRow[];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Markets</h1>
        <p className="mt-1 text-sm text-gray-500">Predict the future. Trade on outcomes.</p>
      </div>

      {markets.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">No open markets yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => {
            const preview = getPreview(market);
            const catColor = CATEGORY_COLORS[market.category] ?? CATEGORY_COLORS.Other;

            return (
              <Link href={`/markets/${market.id}`} key={market.id} className="group block">
                <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:border-gray-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/60">
                  {/* Top row: category + type */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>
                      {market.category}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-400">
                      {market.market_type}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="mb-4 flex-1 text-sm font-semibold leading-snug text-gray-900 group-hover:text-black">
                    {market.title}
                  </p>

                  {/* Price preview */}
                  {preview.type === "binary" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-xl bg-green-50 px-4 py-2.5 text-center ring-1 ring-green-100 transition-all group-hover:ring-green-200">
                          <p className="text-xl font-extrabold text-green-600">{pct(preview.yes)}%</p>
                          <p className="text-xs font-semibold uppercase tracking-widest text-green-400">Yes</p>
                        </div>
                        <div className="flex-1 rounded-xl bg-red-50 px-4 py-2.5 text-center ring-1 ring-red-100 transition-all group-hover:ring-red-200">
                          <p className="text-xl font-extrabold text-red-500">{pct(preview.no)}%</p>
                          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">No</p>
                        </div>
                      </div>
                      {/* Probability bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${pct(preview.yes)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {preview.type === "categorical" && (
                    <div className="space-y-1.5">
                      {preview.items.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-blue-400"
                              style={{ width: `${pct(item.price)}%` }}
                            />
                          </div>
                          <span className="w-24 truncate text-right text-xs text-gray-500">{item.label}</span>
                          <span className="w-9 text-right text-sm font-semibold text-gray-800">
                            {pct(item.price)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {preview.type === "multi" && preview.top && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">{preview.count} questions · Top pick</p>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm text-gray-700">{preview.top.label}</span>
                        <span className="text-sm font-bold text-green-600">{pct(preview.top.yes)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
