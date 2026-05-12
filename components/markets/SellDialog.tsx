"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sellProceedsBinary, sellProceedsCategorical, applySellFee } from "@/lib/pricing";

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

const QUICK_FRACTIONS = [0.25, 0.5, 0.75, 1];

function pct(v: number) { return `${Math.round(v * 100)}%`; }

export function SellDialog({ outcome, market, allOutcomes, side, sharesHeld }: SellDialogProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
      >
        Sell
      </button>
      {mounted && open && (
        <SellModal
          onClose={() => setOpen(false)}
          outcome={outcome}
          market={market}
          allOutcomes={allOutcomes}
          side={side}
          sharesHeld={sharesHeld}
        />
      )}
    </>
  );
}

function SellModal({
  onClose,
  outcome,
  market,
  allOutcomes,
  side,
  sharesHeld,
}: {
  onClose: () => void;
  outcome: OutcomeInfo;
  market: MarketInfo;
  allOutcomes: OutcomeInfo[];
  side: "yes" | "no";
  sharesHeld: number;
}) {
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isCategorical = market.market_type === "categorical";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

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
      gross = sellProceedsBinary(Number(outcome.q_yes), Number(outcome.q_no), market.liquidity_b, side, n);
    }
    return applySellFee(gross);
  }, [shares, side, outcome, market, allOutcomes, isCategorical, sharesHeld]);

  function setFraction(f: number) {
    const val = Math.round(sharesHeld * f * 100) / 100;
    setShares(String(val));
  }

  function addShares(n: number) {
    const current = parseFloat(shares) || 0;
    setShares(String(Math.min(sharesHeld, Math.max(0, Math.round((current + n) * 100) / 100))));
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
    const result = data as { net_proceeds: number };
    toast.success(`Sold ${n} ${side.toUpperCase()} shares for $${Number(result.net_proceeds).toFixed(2)}`);
    onClose();
    router.refresh();
  }

  const sharesNum = parseFloat(shares) || 0;
  const isOverMax = sharesNum > sharesHeld;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${side === "yes" ? "text-green-500" : "text-red-500"}`}>
              Selling {side.toUpperCase()}
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{outcome.label}</h2>
            <p className="mt-0.5 text-sm text-gray-400">You hold <span className="font-semibold text-gray-700">{sharesHeld} shares</span></p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Side indicator */}
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${side === "yes" ? "bg-green-50" : "bg-red-50"}`}>
            {side === "yes"
              ? <TrendingUp className="size-4 text-green-600" />
              : <TrendingDown className="size-4 text-red-500" />}
            <span className={`font-semibold ${side === "yes" ? "text-green-700" : "text-red-600"}`}>
              {side.toUpperCase()} position · {pct(side === "yes"
                ? Math.exp(Number(outcome.q_yes) / market.liquidity_b) / (Math.exp(Number(outcome.q_yes) / market.liquidity_b) + Math.exp(Number(outcome.q_no) / market.liquidity_b))
                : Math.exp(Number(outcome.q_no) / market.liquidity_b) / (Math.exp(Number(outcome.q_yes) / market.liquidity_b) + Math.exp(Number(outcome.q_no) / market.liquidity_b))
              )} current price
            </span>
          </div>

          {/* Shares stepper */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Shares to sell</p>
            <div className={`flex items-center gap-0 rounded-2xl border-2 overflow-hidden transition-colors ${
              isOverMax ? "border-red-400" : side === "yes" ? "border-green-200 focus-within:border-green-400" : "border-red-200 focus-within:border-red-400"
            }`}>
              <button type="button" onClick={() => addShares(-1)} className="flex size-12 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min="0.01"
                max={sharesHeld}
                step="0.01"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent py-3 text-center text-2xl font-black text-gray-900 outline-none placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => addShares(1)} className="flex size-12 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
                <Plus className="size-4" />
              </button>
            </div>
            {isOverMax && <p className="text-xs text-red-500">Max {sharesHeld} shares</p>}

            {/* Fraction buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_FRACTIONS.map((f) => {
                const val = Math.round(sharesHeld * f * 100) / 100;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFraction(f)}
                    className={`rounded-xl py-2 text-sm font-semibold transition-all ${
                      parseFloat(shares) === val
                        ? side === "yes" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {f === 1 ? "Max" : `${f * 100}%`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proceeds summary */}
          <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
            {proceedsPreview ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Gross proceeds</span>
                  <span className="font-semibold text-gray-800">${proceedsPreview.gross.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Fee (1%)</span>
                  <span className="text-sm text-gray-400">−${proceedsPreview.fee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="font-bold text-gray-900">You receive</span>
                  <span className="text-lg font-black text-green-600">+${proceedsPreview.net.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-1">Enter shares above to see proceeds</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="px-5 pb-5 pt-2">
          <button
            disabled={loading || !shares || parseFloat(shares) <= 0 || isOverMax}
            onClick={handleSubmit}
            type="button"
            className="w-full rounded-2xl bg-gray-900 py-4 text-base font-black text-white shadow-lg transition-all hover:bg-gray-700 active:scale-[0.98] disabled:opacity-40"
          >
            {loading
              ? "Selling…"
              : proceedsPreview
              ? `Sell ${side.toUpperCase()} · +$${proceedsPreview.net.toFixed(2)}`
              : `Sell ${side.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
