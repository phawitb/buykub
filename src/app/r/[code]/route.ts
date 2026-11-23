import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_MAX_AGE } from "@/lib/affiliates/referral";

export const dynamic = "force-dynamic";

/**
 * A referral link. Remembers the code for 30 days (the last link opened wins)
 * and sends the visitor to the product page, whose preview is what chat apps show.
 * The code only names a product; nobody learns who shared it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.trim().toLowerCase();
  const home = new URL("/", request.url);
  if (!isReferralCode(code)) return NextResponse.redirect(home, 307);
  const { data } = await createPublicClient().rpc("resolve_affiliate_code", { p_code: code });
  const target = (data as { shop_slug: string; product_slug: string }[] | null)?.[0];
  if (!target) return NextResponse.redirect(home, 307);
  const response = NextResponse.redirect(new URL(`/${encodeURIComponent(target.shop_slug)}/${encodeURIComponent(target.product_slug)}`, request.url), 307);
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: REFERRAL_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
