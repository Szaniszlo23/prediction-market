"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tradeCostBinary, tradeCostCategorical, applyFee } from "@/lib/pricing";
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
  status: string;
};

type TradeDialogProps = {
  outcome: OutcomeInfo;
  market: MarketInfo;
  allOutcomes: OutcomeInfo[];
  /** Pre-select YES or NO when the dialog opens */
  defaultSide?: "yes" | "no";
  /** Show this price on the button (0–1) */
  currentPrice?: number;
  /** For categorical: just label the button "Trade" */
  triggerLabel?: string;
};

function pct(v: number) {
  return `${Math.round(v * 100)}¢`;
}

export function TradeDialog({
  outcome,
  market,
  allOutcomes,
  defaultSide = "yes",
  currentPrice,
  triggerLabel,
}: TradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"yes" | "no">(defaultSide);
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isCategorical = market.market_type === "categorical";
  const activeSide: "yes" | "no" = isCategorical ? "yes" : side;

  const costPreview = useMemo(() => {
    const n = parseFloat(shares);
    if (!n || n <= 0) return null;
    let gross: number;
    if (isCategorical) {
      const sorted = [...allOutcomes].sort((a, b) => a.sort_order - b.sort_order);
      const quantities = sorted.map((o) => Number(o.q_yes));
      const idx = sorted.findIndex((o) => o.id === outcome.id);
      if (idx === -1) return null;
      gross = tradeCostCategorical(quantities, market.liquidity_b, idx, n);
    } else {
      gross = tradeCostBinary(
        Number(outcome.q_yes),
        Number(outcome.q_no),
        market.liquidity_b,
        activeSide,
        n,
      );
    }
    return applyFee(gross);
  }, [shares, activeSide, outcome, market, allOutcomes, isCategorical]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setShares("");
      setSide(defaultSide);
    }
  }

  async function handleSubmit() {
    const n = parseFloat(shares);
    if (!n || n <= 0) {
      toast.error("Enter a valid number of shares");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_trade", {
      p_outcome_id: outcome.id,
      p_side: activeSide,
      p_shares: n,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; total_cost: number; price_after: number };
    toast.success(`Bought ${n} ${activeSide.toUpperCase()} for $${Number(result.total_cost).toFixed(2)}`);
    setOpen(false);
    router.refresh();
  }

  const isMarketClosed = market.status !== "open";
  const priceLabel = currentPrice !== undefined ? pct(currentPrice) : null;

  // ── Trigger button ───────────────────────────────────────────────────────
  const isYesTrigger = !isCategorical && defaultSide === "yes";
  const isNoTrigger = !isCategorical && defaultSide === "no";

  const triggerContent = triggerLabel ? (
    // Categorical "Trade" button
    <button
      disabled={isMarketClosed}
      className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95 disabled:opacity-40"
    >
      {isMarketClosed ? "Closed" : "Trade"}
    </button>
  ) : isYesTrigger ? (
    // YES button — green
    <button
      disabled={isMarketClosed}
      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-green-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-green-200 transition-all hover:bg-green-600 hover:shadow-green-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-40 disabled:hover:translate-y-0"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 opacity-80" />
        <span className="text-base tracking-wide">YES</span>
      </div>
      {priceLabel && (
        <span className="rounded-md bg-green-400/40 px-2 py-0.5 text-sm font-medium">
          {priceLabel}
        </span>
      )}
    </button>
  ) : isNoTrigger ? (
    // NO button — red
    <button
      disabled={isMarketClosed}
      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-red-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-600 hover:shadow-red-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-40 disabled:hover:translate-y-0"
    >
      <div className="flex items-center gap-2">
        <TrendingDown className="size-4 opacity-80" />
        <span className="text-base tracking-wide">NO</span>
      </div>
      {priceLabel && (
        <span className="rounded-md bg-red-400/40 px-2 py-0.5 text-sm font-medium">
          {priceLabel}
        </span>
      )}
    </button>
  ) : (
    // Fallback
    <button
      disabled={isMarketClosed}
      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
    >
      Trade
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        {triggerContent}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCategorical ? `Buy · ${outcome.label}` : `Trade · ${outcome.label}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* YES / NO toggle */}
          {!isCategorical && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide("yes")}
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all ${
                  side === "yes"
                    ? "bg-green-500 text-white shadow-md shadow-green-200"
                    : "border-2 border-green-200 text-green-600 hover:bg-green-50"
                }`}
              >
                <TrendingUp className="size-4" />
                YES
              </button>
              <button
                onClick={() => setSide("no")}
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all ${
                  side === "no"
                    ? "bg-red-500 text-white shadow-md shadow-red-200"
                    : "border-2 border-red-200 text-red-500 hover:bg-red-50"
                }`}
              >
                <TrendingDown className="size-4" />
                NO
              </button>
            </div>
          )}

          {isCategorical && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              Buying <strong>YES</strong> — betting <strong>{outcome.label}</strong> wins
            </div>
          )}

          {/* Shares input */}
          <div className="space-y-1.5">
            <Label htmlFor="trade-shares" className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Shares
            </Label>
            <Input
              id="trade-shares"
              min="0.01"
              onChange={(e) => setShares(e.target.value)}
              placeholder="e.g. 10"
              step="0.01"
              type="number"
              value={shares}
              className="text-lg font-semibold"
            />
          </div>

          {/* Live cost breakdown */}
          {costPreview ? (
            <div className={`rounded-xl p-4 text-sm space-y-2 ${activeSide === "yes" ? "bg-green-50" : "bg-red-50"}`}>
              <div className="flex justify-between text-gray-500">
                <span>Gross cost</span>
                <span>${costPreview.gross.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Fee (1%)</span>
                <span>${costPreview.fee.toFixed(4)}</span>
              </div>
              <div className={`flex justify-between border-t pt-2 text-base font-bold ${activeSide === "yes" ? "border-green-200 text-green-700" : "border-red-200 text-red-600"}`}>
                <span>Total</span>
                <span>${costPreview.total.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Enter shares to see estimated cost</p>
          )}
        </div>

        <DialogFooter showCloseButton={false}>
          <button
            disabled={loading || !shares || parseFloat(shares) <= 0}
            onClick={handleSubmit}
            type="button"
            className={`w-full rounded-xl py-3.5 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 ${
              activeSide === "yes"
                ? "bg-green-500 shadow-green-200 hover:bg-green-600"
                : "bg-red-500 shadow-red-200 hover:bg-red-600"
            }`}
          >
            {loading
              ? "Placing…"
              : `Buy ${activeSide.toUpperCase()}${costPreview ? ` · $${costPreview.total.toFixed(2)}` : ""}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
