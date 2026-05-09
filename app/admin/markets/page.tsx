import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResolveMarketButton } from "@/components/admin/ResolveMarketButton";

type OutcomeRow = {
  id: string;
  label: string;
  sort_order: number;
  resolution: string | null;
};

type MarketRow = {
  id: string;
  title: string;
  market_type: "binary" | "categorical" | "multi";
  status: string;
  created_at: string;
  outcomes: OutcomeRow[];
};

async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) redirect("/");
  return profile;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
  resolved: "bg-blue-50 text-blue-700",
};

const TYPE_LABELS: Record<string, string> = {
  binary: "Yes/No",
  categorical: "Categorical",
  multi: "Multi",
};

export default async function AdminMarketsPage() {
  if (!isSupabaseConfigured()) redirect("/");
  await requireAdminProfile();

  const supabase = createClient();
  const { data } = await supabase
    .from("markets")
    .select("id, title, market_type, status, created_at, outcomes(id, label, sort_order, resolution)")
    .order("created_at", { ascending: false });

  const markets = (data ?? []) as MarketRow[];

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Markets</h1>
          <p className="mt-0.5 text-sm text-gray-500">{markets.length} market{markets.length !== 1 ? "s" : ""} total</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          + Create Market
        </Link>
      </div>

      {markets.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-400">No markets yet.</p>
          <Link href="/admin" className="mt-3 inline-block text-sm font-medium text-gray-700 underline underline-offset-2">
            Create your first market →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {markets.map((market) => {
            const statusStyle = STATUS_STYLES[market.status] ?? STATUS_STYLES.closed;
            const resolvedCount = market.outcomes.filter((o) => o.resolution).length;

            return (
              <div
                key={market.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 transition-colors hover:border-gray-200"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{market.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
                      {market.status}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {TYPE_LABELS[market.market_type] ?? market.market_type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {market.outcomes.length} outcome{market.outcomes.length !== 1 ? "s" : ""}
                    {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
                    {" · "}
                    {new Date(market.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/markets/${market.id}`}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                  >
                    View
                  </Link>
                  <ResolveMarketButton
                    marketId={market.id}
                    marketTitle={market.title}
                    marketType={market.market_type}
                    marketStatus={market.status}
                    outcomes={market.outcomes}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
