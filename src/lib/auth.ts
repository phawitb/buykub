import type { User } from "@supabase/supabase-js";

/** Only use with a user verified by Supabase getUser(), never request input. */
export function isGoogleUser(user: User | null | undefined): user is User {
  return Boolean(
    user &&
      (user.app_metadata?.provider === "google" ||
        user.identities?.some((identity) => identity.provider === "google")),
  );
}

export function safeAuthRedirect(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return "/dashboard/products";
  }
  if (next === "/" || next === "/dashboard") return "/dashboard/products";
  // Auth destinations cannot complete a sign-in and may redirect in a loop.
  try {
    const pathname = decodeURIComponent(new URL(next, "https://buykub.invalid").pathname);
    if (/^\/(login|auth)(\/|$)/.test(pathname)) return "/dashboard/products";
  } catch {
    return "/dashboard/products";
  }
  return next;
}
