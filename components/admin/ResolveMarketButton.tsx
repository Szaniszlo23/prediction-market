"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OutcomeInfo = {
  id: string;
  label: string;
  sort_order: number;
  resolution: string | null;
};

type ResolveMarketButtonProps = {
  marketId: string;
  marketTitle: string;
  marketType: "binary" | "categorical" | "multi";
  marketStatus: string;
  outcomes: OutcomeInfo[];
};

export function ResolveMarketButton({
  marketId,
  marketTitle,
  marketType,
  marketStatus,
  outcomes,
}: ResolveMarketButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // For binary/multi: track per-outcome resolution choice
  const [resolutions, setResolutions] = useState<Record<string, "yes" | "no" | "invalid" | null>>(
    () => Object.fromEntries(outcomes.map((o) => [o.id, o.resolution as "yes" | "no" | "invalid" | null]))
  );
  // For categorical: track which outcome wins
  const [categoricalWinner, setCategoricalWinner] = useState<string>("");
  const router = useRouter();

  const isAlreadyResolved = marketStatus === "resolved";
  const sortedOutcomes = [...outcomes].sort((a, b) => a.sort_order - b.sort_order);

  async function handleResolve() {
    setLoading(true);
    const supabase = createClient();

    try {
      if (marketType === "categorical") {
        if (!categoricalWinner) {
          toast.error("Select a winning outcome");
          setLoading(false);
          return;
        }
        const { error } = await supabase.rpc("resolve_categorical", {
          p_market_id: marketId,
          p_winning_outcome_id: categoricalWinner,
        });
        if (error) throw error;
        toast.success("Market resolved — winners paid out!");
      } else {
        // Binary or multi: resolve each outcome that has a selection
        const toResolve = sortedOutcomes.filter(
          (o) => resolutions[o.id] && resolutions[o.id] !== o.resolution
        );
        if (toResolve.length === 0) {
          toast.error("No changes to resolve");
          setLoading(false);
          return;
        }
        for (const outcome of toResolve) {
          const { error } = await supabase.rpc("resolve_outcome", {
            p_outcome_id: outcome.id,
            p_resolution: resolutions[outcome.id],
          });
          if (error) throw error;
        }
        toast.success(
          toResolve.length === 1
            ? "Outcome resolved — winners paid out!"
            : `${toResolve.length} outcomes resolved — winners paid out!`
        );
      }

      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Resolution failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <button
          disabled={isAlreadyResolved}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAlreadyResolved ? "Resolved" : "Resolve"}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Market</DialogTitle>
          <p className="mt-1 text-sm text-gray-500 leading-snug">{marketTitle}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ── BINARY ── */}
          {marketType === "binary" && sortedOutcomes[0] && (() => {
            const o = sortedOutcomes[0];
            const sel = resolutions[o.id];
            return (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  How did it resolve?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["yes", "no", "invalid"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setResolutions((r) => ({ ...r, [o.id]: val }))}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold transition-all ${
                        sel === val
                          ? val === "yes"
                            ? "bg-green-500 text-white shadow-md shadow-green-200"
                            : val === "no"
                            ? "bg-red-500 text-white shadow-md shadow-red-200"
                            : "bg-gray-700 text-white"
                          : val === "yes"
                          ? "border-2 border-green-200 text-green-600 hover:bg-green-50"
                          : val === "no"
                          ? "border-2 border-red-200 text-red-500 hover:bg-red-50"
                          : "border-2 border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {val === "yes" && <CheckCircle className="size-4" />}
                      {val === "no" && <XCircle className="size-4" />}
                      {val === "invalid" && <AlertCircle className="size-4" />}
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  ))}
                </div>
                {sel === "invalid" && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Invalid will refund all traders their full cost.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ── CATEGORICAL ── */}
          {marketType === "categorical" && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Which outcome won?
              </p>
              <div className="space-y-2">
                {sortedOutcomes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setCategoricalWinner(o.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      categoricalWinner === o.id
                        ? "border-green-300 bg-green-50 text-green-800"
                        : "border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        categoricalWinner === o.id
                          ? "border-green-500 bg-green-500"
                          : "border-gray-300"
                      }`}
                    >
                      {categoricalWinner === o.id && (
                        <div className="size-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="font-medium">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── MULTI ── */}
          {marketType === "multi" && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Resolve each question
              </p>
              {sortedOutcomes.map((o) => {
                const sel = resolutions[o.id];
                const alreadyResolved = !!o.resolution;
                return (
                  <div key={o.id} className="space-y-1.5">
                    <p className="text-sm font-medium text-gray-800">{o.label}</p>
                    {alreadyResolved ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.resolution === "yes"
                            ? "bg-green-50 text-green-700"
                            : o.resolution === "no"
                            ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <CheckCircle className="size-3" />
                        Already resolved: {o.resolution}
                      </span>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["yes", "no", "invalid"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setResolutions((r) => ({ ...r, [o.id]: val }))}
                            className={`rounded-lg py-2 text-xs font-bold transition-all ${
                              sel === val
                                ? val === "yes"
                                  ? "bg-green-500 text-white"
                                  : val === "no"
                                  ? "bg-red-500 text-white"
                                  : "bg-gray-600 text-white"
                                : val === "yes"
                                ? "border border-green-200 text-green-600 hover:bg-green-50"
                                : val === "no"
                                ? "border border-red-200 text-red-500 hover:bg-red-50"
                                : "border border-gray-200 text-gray-400 hover:bg-gray-50"
                            }`}
                          >
                            {val.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Warning */}
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
            ⚠️ Resolution is permanent. Winners will be credited $1 per winning share immediately.
          </div>
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
              disabled={loading}
              onClick={handleResolve}
              type="button"
              className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all hover:bg-gray-700 disabled:opacity-40"
            >
              {loading ? "Resolving…" : "Confirm Resolution"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
