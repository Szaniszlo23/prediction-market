import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type ProfileRow = {
  id: string;
  username: string | null;
  balance: number;
};

const STARTING_BALANCE = 1000;

function fmt(v: number) {
  return `$${v.toFixed(2)}`;
}

function fmtCompact(v: number) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function avatarColor(username: string) {
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-teal-500",
    "bg-emerald-500", "bg-amber-500", "bg-orange-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default async function LeaderboardPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = createClient();
  const currentUser = await getCurrentUser();

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, username, balance")
    .order("balance", { ascending: false });

  const profiles = (profilesRaw ?? []) as ProfileRow[];

  const { data: tradeStatsRaw } = await supabase
    .from("trades")
    .select("user_id, total_cost")
    .gt("shares", 0);

  const tradeStatsMap = new Map<string, { trade_count: number; total_volume: number }>();
  for (const t of (tradeStatsRaw ?? []) as { user_id: string; total_cost: number }[]) {
    const entry = tradeStatsMap.get(t.user_id) ?? { trade_count: 0, total_volume: 0 };
    entry.trade_count += 1;
    entry.total_volume += Number(t.total_cost);
    tradeStatsMap.set(t.user_id, entry);
  }

  const rows = profiles.map((p) => {
    const stats = tradeStatsMap.get(p.id) ?? { trade_count: 0, total_volume: 0 };
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

  rows.sort((a, b) => b.balance - a.balance);

  const top3 = rows.slice(0, 3);
  // Podium order: 2nd · 1st · 3rd
  const podium = rows.length >= 2
    ? [top3[1], top3[0], top3[2]].filter(Boolean)
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 space-y-8">

      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Leaderboard</h1>
        <p className="text-sm text-gray-400">Starting balance {fmt(STARTING_BALANCE)} · Ranked by current balance</p>
      </div>

      {/* Podium */}
      {podium.length >= 2 && (
        <div className="flex items-end justify-center gap-3">

          {podium.map((row, i) => {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;

            const podiumStyles = [
              // 2nd — medium
              { bar: "h-28", card: "border-gray-200 bg-white", accent: "bg-gray-100", nameColor: "text-gray-900", balColor: "text-gray-500", label: "2nd", labelColor: "text-gray-400" },
              // 1st — tallest
              { bar: "h-40", card: "border-yellow-200 bg-gradient-to-b from-yellow-50 to-white", accent: "bg-yellow-400", nameColor: "text-gray-900", balColor: "text-gray-600", label: "1st", labelColor: "text-yellow-500" },
              // 3rd — shortest
              { bar: "h-20", card: "border-orange-200 bg-white", accent: "bg-orange-300", nameColor: "text-gray-900", balColor: "text-gray-500", label: "3rd", labelColor: "text-orange-400" },
            ];

            const s = podiumStyles[i];
            const isYou = row.isCurrentUser;

            return (
              <div key={row.id} className="flex flex-col items-center gap-0 flex-1 max-w-[180px]">
                {/* Card */}
                <div className={`w-full rounded-2xl border-2 p-4 text-center space-y-2 shadow-sm ${
                  isYou ? "border-gray-900 bg-gray-900" : s.card
                }`}>
                  {/* Avatar */}
                  <div className={`mx-auto flex size-12 items-center justify-center rounded-full text-lg font-black text-white ${
                    isYou ? "bg-white/20" : avatarColor(row.username)
                  }`}>
                    {row.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div>
                    <p className={`text-sm font-bold truncate ${isYou ? "text-white" : s.nameColor}`}>
                      {row.username}
                      {isYou && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">you</span>}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${isYou ? "text-gray-300" : s.balColor}`}>
                      {fmt(row.balance)}
                    </p>
                  </div>

                  {/* P&L */}
                  <div className={`text-xs font-bold ${
                    row.profit > 0
                      ? isYou ? "text-green-400" : "text-green-600"
                      : row.profit < 0
                      ? isYou ? "text-red-400" : "text-red-500"
                      : isYou ? "text-gray-400" : "text-gray-400"
                  }`}>
                    {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                  </div>
                </div>

                {/* Podium step */}
                <div className={`w-full rounded-b-xl flex items-center justify-center ${s.bar} ${
                  isYou ? "bg-gray-800" : s.accent
                }`}>
                  <span className={`text-2xl font-black ${isYou ? "text-white/60" : s.labelColor}`}>
                    {rank}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm border-collapse">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-16" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Trader</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">P&amp;L</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Trades</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, index) => {
              const rank = index + 1;
              const rankDisplay = rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}`;
              const isTop3 = rank <= 3;

              return (
                <tr
                  key={row.id}
                  className={`transition-colors ${row.isCurrentUser ? "bg-gray-900" : "hover:bg-gray-50"}`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3.5 text-center">
                    <span className={isTop3 ? "text-base" : `text-xs font-semibold ${row.isCurrentUser ? "text-gray-500" : "text-gray-300"}`}>
                      {rankDisplay}
                    </span>
                  </td>

                  {/* Trader */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`shrink-0 flex size-7 items-center justify-center rounded-full text-xs font-black text-white ${
                        row.isCurrentUser ? "bg-white/20" : avatarColor(row.username)
                      }`}>
                        {row.username.charAt(0).toUpperCase()}
                      </div>
                      <span className={`font-semibold ${row.isCurrentUser ? "text-white" : "text-gray-900"}`}>
                        {row.username}
                      </span>
                      {row.isCurrentUser && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                          you
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Balance */}
                  <td className={`px-4 py-3.5 text-right font-bold tabular-nums ${row.isCurrentUser ? "text-white" : "text-gray-900"}`}>
                    {fmt(row.balance)}
                  </td>

                  {/* P&L */}
                  <td className={`px-4 py-3.5 text-right hidden sm:table-cell`}>
                    <div className={`flex items-center justify-end gap-1 font-semibold tabular-nums ${
                      row.profit > 0
                        ? row.isCurrentUser ? "text-green-400" : "text-green-600"
                        : row.profit < 0
                        ? row.isCurrentUser ? "text-red-400" : "text-red-500"
                        : row.isCurrentUser ? "text-gray-500" : "text-gray-400"
                    }`}>
                      {row.profit > 0
                        ? <TrendingUp className="size-3.5 shrink-0" />
                        : row.profit < 0
                        ? <TrendingDown className="size-3.5 shrink-0" />
                        : <Minus className="size-3.5 shrink-0" />}
                      {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                    </div>
                  </td>

                  {/* Trades */}
                  <td className={`px-4 py-3.5 text-right tabular-nums hidden sm:table-cell ${row.isCurrentUser ? "text-gray-300" : "text-gray-500"}`}>
                    {row.tradeCount}
                  </td>

                  {/* Volume */}
                  <td className={`px-4 py-3.5 text-right tabular-nums hidden md:table-cell ${row.isCurrentUser ? "text-gray-300" : "text-gray-500"}`}>
                    {fmtCompact(row.totalVolume)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-400">No traders yet.</p>
        )}
      </div>
    </main>
  );
}
