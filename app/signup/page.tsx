"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      toast.error("Username must be at least 2 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      toast.error("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Check username is not taken
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmedUsername)
      .maybeSingle();

    if (existing) {
      toast.error("That username is already taken");
      setLoading(false);
      return;
    }

    // Sign up
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Save username immediately (profile row created by DB trigger on signup)
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ username: trimmedUsername })
        .eq("id", data.user.id);
    }

    setLoading(false);
    toast.success(`Welcome, ${trimmedUsername}!`);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="flex size-12 items-center justify-center rounded-2xl bg-gray-900">
            <TrendingUp className="size-6 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
            <p className="mt-1 text-sm text-gray-500">Start predicting the future</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">@</span>
            <input
              type="text"
              autoComplete="username"
              required
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3.5 pl-8 pr-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
            />
          </div>
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gray-900 py-4 text-base font-bold text-white transition-all hover:bg-gray-700 active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-gray-900 underline underline-offset-2">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
