import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser } from "@/lib/auth";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The signed-in buyer's referral link for a product. The database decides who qualifies. */
export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (typeof body?.productId !== "string" || !uuid.test(body.productId)) return NextResponse.json({ error: "Invalid product" }, { status: 400, headers });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isGoogleUser(user)) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers });
  const { data, error } = await supabase.rpc("get_affiliate_link", { p_product: body.productId });
  if (error || typeof data !== "string") {
    const message = error?.message.includes("affiliate_not_eligible") ? "ลิงก์แนะนำใช้ได้เฉพาะผู้ที่ซื้อสินค้านี้แล้ว"
      : error?.message.includes("affiliate_disabled") ? "ร้านค้าปิดลิงก์แนะนำของสินค้านี้แล้ว" : "สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่";
    return NextResponse.json({ error: message }, { status: 409, headers });
  }
  return NextResponse.json({ url: new URL(`/r/${data}`, request.url).toString() }, { headers });
}
