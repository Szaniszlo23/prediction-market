import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/signup", "/setup", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  if (!isSupabaseConfigured()) return response;

  const { url, anonKey } = getSupabaseEnv();
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — nothing to enforce
  if (!user) return response;

  // Already on a public path — let them through
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return response;

  // Check if username is set
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username && pathname !== "/setup") {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return response;
}
