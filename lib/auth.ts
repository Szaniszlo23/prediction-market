import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type ProfileRow = {
  id: string;
  username: string | null;
  balance: number;
  is_admin: boolean;
};

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  if (!isSupabaseConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, balance, is_admin")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data as ProfileRow;
}
