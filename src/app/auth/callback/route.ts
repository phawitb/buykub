import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser, safeAuthRedirect } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = safeAuthRedirect(next);
  let reason = code ? "exchange" : "callback";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (isGoogleUser(user)) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? null,
          },
          { onConflict: "id" },
        );
        return NextResponse.redirect(`${origin}${safeNext}`);
      }

      // The Supabase project is shared: do not revoke other apps' sessions.
      await supabase.auth.signOut({ scope: "local" });
      reason = "google_required";
    } else {
      console.error("Supabase OAuth code exchange failed", error);
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  loginUrl.searchParams.set("reason", reason);
  if (next) loginUrl.searchParams.set("next", safeNext);
  return NextResponse.redirect(loginUrl);
}
