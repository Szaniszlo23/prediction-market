import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MarketCategory = "Sports" | "Politics" | "Crypto" | "Academic" | "Other";
type MarketType = "binary" | "categorical" | "multi";

type AdminPageProps = {
  searchParams?: {
    tab?: string;
    error?: string;
  };
};

async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) redirect("/");
  return profile;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!isSupabaseConfigured()) redirect("/");

  const profile = await requireAdminProfile();
  const activeTab = searchParams?.tab === "requests" ? "requests" : "create";
  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  async function createMarket(formData: FormData) {
    "use server";

    const adminProfile = await requireAdminProfile();
    const supabase = createClient();

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "Other") as MarketCategory;
    const marketType = String(formData.get("market_type") ?? "binary") as MarketType;
    const resolvesAtRaw = String(formData.get("resolves_at") ?? "").trim();
    const liquidityInput = Number(formData.get("liquidity_b"));
    const outcomesJson = String(formData.get("outcomes_json") ?? "[]");

    if (!title || Number.isNaN(liquidityInput) || liquidityInput <= 0) {
      redirect("/admin?tab=create");
    }

    const allowedCategories = new Set<MarketCategory>(["Sports", "Politics", "Crypto", "Academic", "Other"]);
    const allowedTypes = new Set<MarketType>(["binary", "categorical", "multi"]);
    const safeCategory: MarketCategory = allowedCategories.has(category) ? category : "Other";
    const safeType: MarketType = allowedTypes.has(marketType) ? marketType : "binary";
    const resolvesAt =
      resolvesAtRaw.length > 0 && !Number.isNaN(new Date(resolvesAtRaw).getTime())
        ? new Date(resolvesAtRaw).toISOString()
        : null;

    let parsedOutcomes: string[] = [];
    try {
      const raw = JSON.parse(outcomesJson) as unknown;
      if (Array.isArray(raw)) {
        parsedOutcomes = raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
      }
    } catch {
      parsedOutcomes = [];
    }

    if (safeType === "binary") {
      parsedOutcomes = [parsedOutcomes[0] || title];
    } else if (safeType === "categorical") {
      if (parsedOutcomes.length < 2 || parsedOutcomes.length > 10) redirect("/admin?tab=create");
    } else if (parsedOutcomes.length < 1 || parsedOutcomes.length > 20) {
      redirect("/admin?tab=create");
    }

    const { data: insertedMarket, error: insertMarketError } = await supabase
      .from("markets")
      .insert({
        title,
        description,
        category: safeCategory,
        market_type: safeType,
        resolves_at: resolvesAt,
        liquidity_b: liquidityInput,
        status: "open",
        created_by: adminProfile.id,
      })
      .select("id")
      .single();

    if (insertMarketError || !insertedMarket) {
      const msg = encodeURIComponent(insertMarketError?.message ?? "Unknown error");
      redirect(`/admin?tab=create&error=${msg}`);
    }

    const outcomesToInsert = parsedOutcomes.map((label, sortOrder) => ({
      market_id: insertedMarket.id,
      label,
      sort_order: sortOrder,
    }));

    const { error: insertOutcomesError } = await supabase.from("outcomes").insert(outcomesToInsert);
    if (insertOutcomesError) {
      const msg = encodeURIComponent(insertOutcomesError.message);
      redirect(`/admin?tab=create&error=${msg}`);
    }

    revalidatePath("/admin");
    revalidatePath("/admin/markets");
    redirect(`/markets/${insertedMarket.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Manage markets and moderation tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTabs
            createMarket={createMarket}
            adminId={profile.id}
            initialTab={activeTab}
            errorMessage={errorMessage}
          />
        </CardContent>
      </Card>
    </main>
  );
}
