import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function Navbar() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;

  async function logout() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-gray-900">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gray-900">
            <TrendingUp className="size-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">Forecast</span>
        </Link>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-2">
            {/* Balance chip */}
            <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
              <span className="text-xs text-gray-400">$</span>
              <span>{Number(profile?.balance ?? 0).toFixed(2)}</span>
            </div>

            {/* Username */}
            <span className="hidden text-sm text-gray-500 sm:block">
              {profile?.username ?? user.email?.split("@")[0]}
            </span>

            {/* Admin */}
            {profile?.is_admin ? (
              <Link
                href="/admin"
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                Admin
              </Link>
            ) : null}

            {/* Sign out */}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
