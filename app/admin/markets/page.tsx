import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResolveMarketButton } from "@/components/admin/ResolveMarketButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MarketRow = {
  id: string;
  title: string;
  market_type: "binary" | "categorical" | "multi";
  status: string;
  created_at: string;
};

async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) {
    redirect("/");
  }

  return profile;
}

export default async function AdminMarketsPage() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const profile = await requireAdminProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("markets")
    .select("id, title, market_type, status, created_at")
    .order("created_at", { ascending: false });

  const markets = (data ?? []) as MarketRow[];

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Markets</CardTitle>
          <CardDescription>Markets created by your admin account.</CardDescription>
        </CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No markets yet. <Link className="underline" href="/admin">Create one</Link>.
            </p>
          ) : (
            <div className="space-y-2">
              {markets.map((market) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={market.id}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{market.title}</p>
                      <Badge variant="outline">{market.market_type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Status: {market.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="text-sm underline" href={`/markets/${market.id}`}>
                      View
                    </Link>
                    <ResolveMarketButton marketTitle={market.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
