import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";

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
    <header className="border-b">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link className="text-lg font-semibold" href="/">
          Prediction Market
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wallet className="size-4" />
              <span>{profile?.balance ?? 0}</span>
            </div>
            <span className="text-sm">{profile?.username ?? user.email}</span>
            {profile?.is_admin ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/admin">
                Admin
              </Link>
            ) : null}
            <form action={logout}>
              <Button size="sm" variant="outline" type="submit">
                Logout
              </Button>
            </form>
          </div>
        ) : (
          <Link className={buttonVariants({ size: "sm" })} href="/login">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
