"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const name = data?.username ?? "";
      setUsername(name);
      setOriginal(name);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) { toast.error("Username can't be empty"); return; }
    if (trimmed === original) { toast("No changes to save"); return; }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }

    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .neq("id", user.id)
      .single();

    if (existing) {
      toast.error("That username is already taken");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user.id);

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    setOriginal(trimmed);
    toast.success("Username updated!");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your account</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. cryptoking"
              maxLength={30}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-400">
              This is how you appear on the leaderboard and in comments.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !username.trim() || username.trim() === original}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save username"}
          </button>
        </form>
      </div>
    </main>
  );
}
