"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("Invalid email or password"); return; }
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
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Log in to your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
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
            autoComplete="current-password"
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
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-gray-900 underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
