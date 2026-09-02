import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session refresh for Middleware
 * Must be called on every request that needs auth.
 * Returns { supabase, response } — response must be returned from middleware to sync cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[middleware] Missing Supabase env vars");
    // Return dummy supabase that always returns no user, so protected routes redirect
    const dummy = {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as unknown as ReturnType<typeof createServerClient>;
    return { supabase: dummy, response: supabaseResponse };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // Refresh session if expired — this also populates supabase auth context
  // Do NOT use getSession here; use getUser for security (validates JWT with Supabase)
  await supabase.auth.getUser();

  return { supabase, response: supabaseResponse };
}
