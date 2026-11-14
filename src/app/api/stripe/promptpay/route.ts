import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { expirePromptpay, type PromptpayContext } from "@/lib/payments/promptpay";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  const receipt = new URL(request.url).searchParams.get("receipt");
  if (!receipt || !/^pp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt)) return NextResponse.json({ error: "Invalid receipt" }, { status: 400, headers });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("stripe_checkout_contexts").select("checkout_reference,stripe_session_id,stripe_payment_intent_id,promptpay_expires_at,status,amount_cents,products(name)").eq("stripe_session_id", receipt).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "ไม่พบรายการชำระเงิน" }, { status: 404, headers });
    const context = data as unknown as PromptpayContext & { products: {name:string} | null };
    const receiptUrl = `/checkout/success?session_id=${receipt}`;
    if (context.status === "completed") return NextResponse.json({ status: "completed", receiptUrl }, { headers });
    if (context.status === "cancelled") return NextResponse.json({ status: "expired" }, { headers });
    if (!context.stripe_payment_intent_id) return NextResponse.json({ status: "preparing" }, { headers });
    let intent = await getStripe().paymentIntents.retrieve(context.stripe_payment_intent_id);
    if (context.promptpay_expires_at && new Date(context.promptpay_expires_at).getTime() <= Date.now()) {
      await expirePromptpay(context, admin);
      intent = await getStripe().paymentIntents.retrieve(context.stripe_payment_intent_id);
    }
    if (intent.status === "canceled" || intent.status === "requires_payment_method") return NextResponse.json({ status: "expired" }, { headers });
    if (intent.status === "succeeded" || intent.status === "processing") return NextResponse.json({ status: "processing", receiptUrl }, { headers });
    const qr = intent.next_action?.promptpay_display_qr_code;
    if (!qr) return NextResponse.json({ status: "preparing" }, { headers });
    return NextResponse.json({ status: "awaiting_payment", name: context.products?.name, amountCents: context.amount_cents, qrUrl: qr.image_url_png, instructionsUrl: qr.hosted_instructions_url, expiresAt: context.promptpay_expires_at, testMode: !intent.livemode }, { headers });
  } catch {
    return NextResponse.json({ error: "ตรวจสอบการชำระเงินไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers });
  }
}
