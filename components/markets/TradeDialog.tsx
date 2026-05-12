"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, X, Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tradeCostBinary, tradeCostCategorical, applyFee, lmsrPriceBinary, lmsrPriceCategorical } from "@/lib/pricing";

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
  defaultSide?: "yes" | "no";
  currentPrice?: number;
  triggerLabel?: string;
};

const QUICK_AMOUNTS = [5, 10, 25, 50];

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function cents(v: number) { return `${Math.round(v * 100)}¢`; }

// ── Modal ────────────────────────────────────────────────────────────────────
function TradeModal({
  open,
  onClose,
  outcome,
  market,
  allOutcomes,
  defaultSide,
}: {
  open: boolean;
  onClose: () => void;
  outcome: OutcomeInfo;
  market: MarketInfo;
  allOutcomes: OutcomeInfo[];
  defaultSide: "yes" | "no";
}) {
  const [side, setSide] = useState<"yes" | "no">(defaultSide);
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isCategorical = market.market_type === "categorical";
  const activeSide: "yes" | "no" = isCategorical ? "yes" : side;

  // Current prices
  const { yesPrice, noPrice } = useMemo(() => {
    const b = market.liquidity_b;
    if (isCategorical) {
      const sorted = [...allOutcomes].sort((a, b) => a.sort_order - b.sort_order);
      const quantities = sorted.map((o) => Number(o.q_yes));
      const idx = sorted.findIndex((o) => o.id === outcome.id);
      const p = idx >= 0 ? lmsrPriceCategorical(quantities, b, idx) : 0.5;
      return { yesPrice: p, noPrice: 1 - p };
    }
    return {
      yesPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "yes"),
      noPrice: lmsrPriceBinary(Number(outcome.q_yes), Number(outcome.q_no), b, "no"),
    };
  }, [outcome, market, allOutcomes, isCategorical]);

  const activePrice = activeSide === "yes" ? yesPrice : noPrice;

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
      gross = tradeCostBinary(Number(outcome.q_yes), Number(outcome.q_no), market.liquidity_b, activeSide, n);
    }
    return applyFee(gross);
  }, [shares, activeSide, outcome, market, allOutcomes, isCategorical]);

  // Reset on open/side change
  useEffect(() => {
    if (open) { setShares(""); setSide(defaultSide); }
  }, [open, defaultSide]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function addShares(n: number) {
    const current = parseFloat(shares) || 0;
    setShares(String(Math.max(0, current + n)));
  }

  async function handleSubmit() {
    const n = parseFloat(shares);
    if (!n || n <= 0) { toast.error("Enter a valid number of shares"); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_trade", {
      p_outcome_id: outcome.id,
      p_side: activeSide,
      p_shares: n,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { total_cost: number };
    toast.success(`Bought ${n} ${activeSide.toUpperCase()} shares for $${Number(result.total_cost).toFixed(2)}`);
    onClose();
    router.refresh();
  }

  if (!open) return null;

  const sharesNum = parseFloat(shares) || 0;
  const potentialPayout = sharesNum * 1.0; // $1 per share if wins

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400 mb-1">
              {isCategorical ? "Buy YES" : "Trade"}
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{outcome.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">

          {/* YES / NO selector */}
          {!isCategorical && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5">
              {(["yes", "no"] as const).map((s) => {
                const price = s === "yes" ? yesPrice : noPrice;
                const isActive = side === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-3 transition-all ${
                      isActive
                        ? s === "yes"
                          ? "bg-green-500 text-white shadow-md"
                          : "bg-red-500 text-white shadow-md"
                        : "text-gray-500 hover:bg-white/60"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                      {s === "yes" ? "Yes" : "No"}
                    </span>
                    <span className={`text-xl font-black ${isActive ? "text-white" : s === "yes" ? "text-green-600" : "text-red-500"}`}>
                      {pct(price)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Categorical info pill */}
          {isCategorical && (
            <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-2.5">
              <span className="text-sm text-green-700">Backing <strong>{outcome.label}</strong> to win</span>
              <span className="text-lg font-black text-green-600">{pct(yesPrice)}</span>
            </div>
          )}

          {/* Shares input */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Shares</p>

            {/* Stepper */}
            <div className={`flex items-center gap-0 rounded-2xl border-2 overflow-hidden transition-colors ${
              activeSide === "yes" ? "border-green-200 focus-within:border-green-400" : "border-red-200 focus-within:border-red-400"
            }`}>
              <button
                type="button"
                onClick={() => addShares(-1)}
                className="flex size-12 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent py-3 text-center text-2xl font-black text-gray-900 outline-none placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => addShares(1)}
                className="flex size-12 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setShares(String(n))}
                  className={`rounded-xl py-2 text-sm font-semibold transition-all ${
                    parseFloat(shares) === n
                      ? activeSide === "yes"
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary */}
          <div className={`rounded-2xl p-4 space-y-3 ${activeSide === "yes" ? "bg-green-50" : "bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Price per share</span>
              <span className="font-semibold text-gray-800">{cents(activePrice)}</span>
            </div>
            {costPreview && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Fee (1%)</span>
                  <span className="text-sm text-gray-400">−${costPreview.fee.toFixed(2)}</span>
                </div>
                <div className={`flex items-center justify-between border-t pt-3 ${activeSide === "yes" ? "border-green-200" : "border-red-200"}`}>
                  <span className="font-bold text-gray-900">Total cost</span>
                  <span className={`text-lg font-black ${activeSide === "yes" ? "text-green-700" : "text-red-600"}`}>
                    ${costPreview.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Potential payout if wins</span>
                  <span className="text-sm font-semibold text-gray-700">
                    ${potentialPayout.toFixed(2)}
                    <span className={`ml-1 text-xs ${potentialPayout > costPreview.total ? "text-green-600" : "text-red-500"}`}>
                      ({potentialPayout > costPreview.total ? "+" : ""}{((potentialPayout / costPreview.total - 1) * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
              </>
            )}
            {!costPreview && (
              <p className="text-sm text-gray-400 text-center py-1">Enter shares above to see cost</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="px-5 pb-5 pt-2">
          <button
            disabled={loading || !shares || parseFloat(shares) <= 0}
            onClick={handleSubmit}
            type="button"
            className={`w-full rounded-2xl py-4 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 ${
              activeSide === "yes"
                ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200"
                : "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200"
            }`}
          >
            {loading
              ? "Placing order…"
              : costPreview
              ? `Buy ${activeSide.toUpperCase()} · $${costPreview.total.toFixed(2)}`
              : `Buy ${activeSide.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Trigger + outer component ────────────────────────────────────────────────
export function TradeDialog({
  outcome,
  market,
  allOutcomes,
  defaultSide = "yes",
  currentPrice,
  triggerLabel,
}: TradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isMarketClosed = market.status !== "open";
  const isCategorical = market.market_type === "categorical";
  const priceLabel = currentPrice !== undefined ? `${Math.round(currentPrice * 100)}¢` : null;
  const isYesTrigger = !isCategorical && defaultSide === "yes";
  const isNoTrigger = !isCategorical && defaultSide === "no";

  const triggerContent = triggerLabel ? (
    <button
      onClick={() => setOpen(true)}
      disabled={isMarketClosed}
      className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95 disabled:opacity-40"
    >
      {isMarketClosed ? "Closed" : "Trade"}
    </button>
  ) : isYesTrigger ? (
    <button
      onClick={() => setOpen(true)}
      disabled={isMarketClosed}
      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-green-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-green-200 transition-all hover:bg-green-600 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-40"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 opacity-80" />
        <span className="text-base tracking-wide">YES</span>
      </div>
      {priceLabel && (
        <span className="rounded-md bg-green-400/40 px-2 py-0.5 text-sm font-medium">{priceLabel}</span>
      )}
    </button>
  ) : isNoTrigger ? (
    <button
      onClick={() => setOpen(true)}
      disabled={isMarketClosed}
      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-red-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-600 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-40"
    >
      <div className="flex items-center gap-2">
        <TrendingDown className="size-4 opacity-80" />
        <span className="text-base tracking-wide">NO</span>
      </div>
      {priceLabel && (
        <span className="rounded-md bg-red-400/40 px-2 py-0.5 text-sm font-medium">{priceLabel}</span>
      )}
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      disabled={isMarketClosed}
      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
    >
      Trade
    </button>
  );

  return (
    <>
      {triggerContent}
      {mounted && (
        <TradeModal
          open={open}
          onClose={() => setOpen(false)}
          outcome={outcome}
          market={market}
          allOutcomes={allOutcomes}
          defaultSide={defaultSide}
        />
      )}
    </>
  );
}
