"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Sports", "Politics", "Crypto", "Academic", "Other"] as const;

export function RequestMarketDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-500 transition-all hover:border-gray-400 hover:text-gray-700 active:scale-[0.98]"
      >
        <Lightbulb className="size-4" />
        Suggest a market
      </button>
      {mounted && open && createPortal(
        <RequestModal onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("Other");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (t.length < 5) { toast.error("Please write a fuller question (min 5 chars)"); return; }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); setLoading(false); return; }

    const { error } = await supabase.from("market_requests").insert({
      user_id: user.id,
      title: t,
      description: description.trim() || null,
      category,
    });

    setLoading(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Request submitted! Admins will review it soon.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-yellow-50">
              <Lightbulb className="size-5 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Suggest a market</h2>
              <p className="text-xs text-gray-400">Admins review all requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">

            {/* Question */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Question
              </label>
              <input
                autoFocus
                type="text"
                placeholder='e.g. "Will Argentina win the 2026 World Cup?"'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                      category === c
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra context */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Extra context <span className="font-normal normal-case text-gray-300">(optional)</span>
              </label>
              <textarea
                placeholder="Any extra info that would help set up this market..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full resize-none rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="px-5 pb-5 pt-1">
            <button
              type="submit"
              disabled={loading || title.trim().length < 5}
              className="w-full rounded-2xl bg-gray-900 py-4 text-base font-bold text-white transition-all hover:bg-gray-700 active:scale-[0.98] disabled:opacity-40"
            >
              {loading ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
