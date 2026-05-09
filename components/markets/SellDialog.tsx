"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sellProceedsBinary, sellProceedsCategorical, applySellFee } from "@/lib/pricing";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OutcomeInfo = {
  id: string;
  label: string;
  q_yes: number;
  q_no: number;
  sort_order: number;
};

type MarketInfo = {
  id: string;
  market_type: "binary" | "categorical" | "multi";
  liquidity_b: number;
};

type SellDialogProps = {
  outcome: OutcomeInfo;
  market: MarketInfo;
  allOutcomes: OutcomeInfo[];
  side: "yes" | "no";
  sharesHeld: number;
};

export function SellDialog({ outcome, market, allOutcomes, side, sharesHeld }: SellDialogProps) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isCategorical = market.market_type === "categorical";

  const proceedsPreview = useMemo(() => {
    const n = parseFloat(shares);
    if (!n || n <= 0 || n > sharesHeld) return null;
    let gross: number;
    if (isCategorical) {
      const sorted = [...allOutcomes].sort((a, b) => a.sort_order - b.sort_order);
      const quantities = sorted.map((o) => Number(o.q_yes));
      const idx = sorted.findIndex((o) => o.id === outcome.id);
      if (idx === -1) return null;
      gross = sellProceedsCategorical(quantities, market.liquidity_b, idx, n);
    } else {
      gross = sellProceedsBinary(
        Number(outcome.q_yes),
        Number(outcome.q_no),
        market.liquidity_b,
        side,
        n,
      );
    }
    return applySellFee(gross);
  }, [shares, side, outcome, market, allOutcomes, isCategorical, sharesHeld]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setShares("");
  }

  async function handleSubmit() {
    const n = parseFloat(shares);
    if (!n || n <= 0) { toast.error("Enter a valid number of shares"); return; }
    if (n > sharesHeld) { toast.error(`You only hold ${sharesHeld} shares`); return; }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("sell_shares", {
      p_outcome_id: outcome.id,
      p_side: side,
      p_shares: n,
    });
    setLoading(false);

    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; net_proceeds: number; price_after: number };
    toast.success(`Sold ${n} ${side.toUpperCase()} for $${Number(result.net_proceeds).toFixed(2)}`);
    setOpen(false);
    router.refresh();
  }

  const sharesNum = parseFloat(shares);
  const isOverMax = sharesNum > sharesHeld;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95">
          Sell
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell · {outcome.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current position info */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${side === "yes" ? "bg-green-50" : "bg-red-50"}`}>
            <div className="flex items-center gap-2">
              {side === "yes"
                ? <TrendingUp className="size-4 text-green-600" />
                : <TrendingDown className="size-4 text-red-500" />}
              <span className={`font-bold ${side === "yes" ? "text-green-700" : "text-red-600"}`}>
                {side.toUpperCase()} position
              </span>
            </div>
            <span className={`text-sm font-semibold ${side === "yes" ? "text-green-700" : "text-red-600"}`}>
              {sharesHeld} shares held
            </span>
          </div>

          {/* Shares input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sell-shares" className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Shares to sell
              </Label>
              <button
                type="button"
                onClick={() => setShares(String(sharesHeld))}
                className="text-xs font-medium text-gray-400 underline underline-offset-2 hover:text-gray-600"
              >
                Max ({sharesHeld})
              </button>
            </div>
            <Input
              id="sell-shares"
              min="0.01"
              max={sharesHeld}
              onChange={(e) => setShares(e.target.value)}
              placeholder={`e.g. ${Math.min(sharesHeld, 10)}`}
              step="0.01"
              type="number"
              value={shares}
              className={`text-lg font-semibold ${isOverMax ? "border-red-300 focus-visible:ring-red-300" : ""}`}
            />
            {isOverMax && (
              <p className="text-xs text-red-500">Maximum {sharesHeld} shares</p>
            )}
          </div>

          {/* Live proceeds breakdown */}
          {proceedsPreview ? (
            <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-2">
              <div className="flex justify-between text-gray-500">
                <span>Gross proceeds</span>
                <span className="text-green-600">+${proceedsPreview.gross.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Fee (1%)</span>
                <span>−${proceedsPreview.fee.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                <span className="text-gray-700">You receive</span>
                <span className="text-green-600">+${proceedsPreview.net.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Enter shares to see estimated proceeds</p>
          )}
        </div>

        <DialogFooter showCloseButton={false}>
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={loading || !shares || parseFloat(shares) <= 0 || isOverMax}
              onClick={handleSubmit}
              type="button"
              className="flex-1 rounded-xl bg-gray-900 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-gray-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {loading
                ? "Selling…"
                : `Sell ${side.toUpperCase()}${proceedsPreview ? ` · +$${proceedsPreview.net.toFixed(2)}` : ""}`}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
