import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth";

type ProfileRow = {
  id: string;
  username: string | null;
  balance: number;
};

type TradeStats = {
  user_id: string;
  trade_count: number;
  total_volume: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];
const STARTING_BALANCE = 1000;

function fmt(v: number) {
  return `$${v.toFixed(2)}`;
}

function fmtVolume(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default async function LeaderboardPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = createClient();
  const currentUser = await getCurrentUser();

  // All profiles
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, username, balance")
    .order("balance", { ascending: false });

  const profiles = (profilesRaw ?? []) as ProfileRow[];

  // Trade stats per user: count + total buy volume
  const { data: tradeStatsRaw } = await supabase
    .from("trades")
    .select("user_id, total_cost")
    .gt("shares", 0); // buys only (positive shares)

  const tradeStatsMap = new Map<string, TradeStats>();
  for (const t of (tradeStatsRaw ?? []) as { user_id: string; total_cost: number }[]) {
    const entry = tradeStatsMap.get(t.user_id) ?? { user_id: t.user_id, trade_count: 0, total_volume: 0 };
    entry.trade_count += 1;
    entry.total_volume += Number(t.total_cost);
    tradeStatsMap.set(t.user_id, entry);
  }

  // Merge
  const rows = profiles.map((p) => {
    const stats = tradeStatsMap.get(p.id) ?? { user_id: p.id, trade_count: 0, total_volume: 0 };
    const profit = Number(p.balance) - STARTING_BALANCE;
    return {
      id: p.id,
      username: p.username ?? "anonymous",
      balance: Number(p.balance),
      profit,
      tradeCount: stats.trade_count,
      totalVolume: stats.total_volume,
      isCurrentUser: p.id === currentUser?.id,
    };
  });

  // Sort by balance desc
  rows.sort((a, b) => b.balance - a.balance);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Leaderboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">Ranked by current balance · Starting balance {fmt(STARTING_BALANCE)}</p>
      </div>

      {/* Top 3 podium */}
      {rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 items-end">
          {[rows[1], rows[0], rows[2]].map((row, i) => {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const medal = MEDALS[rank - 1];
            // Step effect via top padding — content always fully visible
            const topPadding = ["pt-8", "pt-2", "pt-12"];
            return (
              <div
                key={row.id}
                className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-all ${topPadding[i]} ${
                  row.isCurrentUser
                    ? "border-gray-900 bg-gray-900 text-white"
                    : rank === 1
                    ? "border-yellow-200 bg-yellow-50"
                    : rank === 2
                    ? "border-gray-200 bg-gray-50"
                    : "border-orange-100 bg-orange-50"
                }`}
              >
                <p className="text-3xl">{medal}</p>
                <p className={`mt-1.5 text-sm font-bold truncate w-full ${row.isCurrentUser ? "text-white" : "text-gray-900"}`}>
                  {row.username}
                </p>
                <p className={`text-xs font-semibold mt-0.5 ${row.isCurrentUser ? "text-gray-300" : "text-gray-500"}`}>
                  {fmt(row.balance)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Rank</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Trader</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Balance</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400 hidden sm:table-cell">P&amp;L</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400 hidden sm:table-cell">Trades</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400 hidden md:table-cell">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, index) => {
              const rank = index + 1;
              const medal = MEDALS[rank - 1];
              return (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    row.isCurrentUser
                      ? "bg-gray-900 text-white"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-5 py-3.5 font-semibold">
                    {medal ? (
                      <span className="text-base">{medal}</span>
                    ) : (
                      <span className={row.isCurrentUser ? "text-gray-400" : "text-gray-400"}>#{rank}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${row.isCurrentUser ? "text-white" : "text-gray-900"}`}>
                        {row.username}
                      </span>
                      {row.isCurrentUser && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                          you
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-5 py-3.5 text-right font-bold ${row.isCurrentUser ? "text-white" : "text-gray-900"}`}>
                    {fmt(row.balance)}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-semibold hidden sm:table-cell ${
                    row.profit > 0
                      ? row.isCurrentUser ? "text-green-400" : "text-green-600"
                      : row.profit < 0
                      ? row.isCurrentUser ? "text-red-400" : "text-red-500"
                      : row.isCurrentUser ? "text-gray-400" : "text-gray-400"
                  }`}>
                    {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                  </td>
                  <td className={`px-5 py-3.5 text-right hidden sm:table-cell ${row.isCurrentUser ? "text-gray-300" : "text-gray-500"}`}>
                    {row.tradeCount}
                  </td>
                  <td className={`px-5 py-3.5 text-right hidden md:table-cell ${row.isCurrentUser ? "text-gray-300" : "text-gray-500"}`}>
                    {fmtVolume(row.totalVolume)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">No traders yet.</p>
        )}
      </div>
    </main>
  );
}
