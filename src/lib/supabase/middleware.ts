import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname === "/dashboard/bookings" ||
      request.nextUrl.pathname.startsWith("/dashboard/bookings/")) {
    return NextResponse.redirect(new URL("/dashboard/products", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verify the signed token locally when possible; server pages still call
  // getUser() for current account validity before returning private data.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  const hasUser = typeof claims?.sub === "string" && claims.sub.length > 0;
  const google = hasUser && (claims?.app_metadata?.provider === "google" ||
    (Array.isArray(claims?.app_metadata?.providers) && claims.app_metadata.providers.includes("google")));

  const isProtected = request.nextUrl.pathname === "/dashboard" ||
    request.nextUrl.pathname.startsWith("/dashboard/") ||
    request.nextUrl.pathname === "/learn" ||
    request.nextUrl.pathname.startsWith("/learn/");

  if (isProtected && !google) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    if (hasUser) {
      url.searchParams.set("error", "auth");
      url.searchParams.set("reason", "google_required");
    }
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  return supabaseResponse;
}
