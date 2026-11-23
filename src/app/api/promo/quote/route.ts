import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePromoCode, promoErrorMessage } from "@/lib/promo/codes";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** What a promo code takes off one product. The checkout applies the same rules again. */
export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { body = null; }
  if (typeof body?.productId !== "string" || !uuid.test(body.productId)) return NextResponse.json({ error: "Invalid product" }, { status: 400, headers });
  const code = normalizePromoCode(body.code);
  if (!code) return NextResponse.json({ error: "รูปแบบโค้ดไม่ถูกต้อง" }, { status: 400, headers });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_promo_code", { p_product: body.productId, p_code: code }).maybeSingle<{ code: string; list_cents: number; discount_cents: number; final_cents: number }>();
  if (error || !data) return NextResponse.json({ error: promoErrorMessage(error?.message) ?? "ตรวจสอบโค้ดไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: error && promoErrorMessage(error.message) ? 409 : 502, headers });
  return NextResponse.json({ code: data.code, listCents: data.list_cents, discountCents: data.discount_cents, finalCents: data.final_cents }, { headers });
}
