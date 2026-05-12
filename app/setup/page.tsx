"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // If they already have a username, skip setup
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (data?.username) {
        router.replace("/");
        return;
      }
      setChecking(false);
    }
    check();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) { toast.error("Username must be at least 2 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      toast.error("Only letters, numbers, and underscores allowed");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }

    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      toast.error("That username is taken — try another");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user.id);

    setLoading(false);
    if (error) { toast.error(error.message); return; }

    toast.success(`Welcome, ${trimmed}!`);
    router.push("/");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gray-900">
            <TrendingUp className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pick your username</h1>
            <p className="mt-1 text-sm text-gray-500">
              This is how you'll appear on the leaderboard and in comments.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">@</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              maxLength={30}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white py-4 pl-8 pr-4 text-lg font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors"
            />
          </div>

          <p className="px-1 text-xs text-gray-400">
            Letters, numbers, underscores only · 2–30 characters
          </p>

          <button
            type="submit"
            disabled={loading || username.trim().length < 2}
            className="w-full rounded-2xl bg-gray-900 py-4 text-base font-bold text-white transition-all hover:bg-gray-700 active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? "Saving…" : "Continue →"}
          </button>
        </form>
      </div>
    </main>
  );
}
