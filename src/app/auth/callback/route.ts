import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const calendar = searchParams.get("calendar") === "1";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        let providerRefreshToken =
          data.session?.provider_refresh_token ?? null;
        if (
          calendar &&
          data.session?.provider_token &&
          !providerRefreshToken
        ) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("google_provider_refresh_token")
            .eq("id", user.id)
            .maybeSingle();
          providerRefreshToken =
            existingProfile?.google_provider_refresh_token ?? null;
        }

        await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
              avatar_url: user.user_metadata?.avatar_url ?? null,
              ...(calendar && data.session?.provider_token
                ? {
                    google_provider_token: data.session.provider_token,
                    google_provider_refresh_token:
                      providerRefreshToken,
                    google_calendar_connected_at: new Date().toISOString(),
                  }
                : {}),
            },
            { onConflict: "id" },
          );
      }

      return NextResponse.redirect(`${origin}${safeNext}`);
    }

    console.error("Supabase OAuth code exchange failed", error);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  loginUrl.searchParams.set("reason", code ? "exchange" : "callback");
  if (safeNext !== "/dashboard" || next === "/dashboard") {
    loginUrl.searchParams.set("next", safeNext);
  }
  return NextResponse.redirect(loginUrl);
}
