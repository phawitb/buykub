import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { cleanupExpiredPromptpay } from "@/lib/payments/promptpay";
import { MIN_PRICE_BAHT } from "@/features/products/validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function error(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status, headers });
}
export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return error("Invalid checkout request", 400); }
  if (body?.kind === "service") return error("ระบบจองบริการพักให้บริการชั่วคราว", 410);
  if (body?.kind !== "product" || typeof body.productId !== "string" || !uuid.test(body.productId)) return error("Invalid product", 400);
  if (body.requestId !== undefined && (typeof body.requestId !== "string" || !uuid.test(body.requestId))) return error("Invalid request ID", 400);
  const reference = body.requestId || randomUUID();
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    // Authenticate every purchase before reserving stock or touching payments.
    // Delivery and the buyer's library share this confirmed account email.
    if (authError || !isGoogleUser(user) || !user.email_confirmed_at || !user.email) return error("กรุณาเข้าสู่ระบบด้วย Google ก่อนซื้อสินค้า", 401, "google_login_required");
    const normalizedEmail = user.email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return error("กรุณาเข้าสู่ระบบด้วย Google เพื่อยืนยันอีเมลรับสินค้า", 401, "google_login_required");
    const { data: product } = await supabase.from("products").select("delivery_type,name,price_cents").eq("id", body.productId).maybeSingle();
    if (!product) return error("สินค้านี้ไม่พร้อมจำหน่าย", 409);
    // Stripe refuses THB charges under ฿10; say so before reserving anything.
    if (product.price_cents < MIN_PRICE_BAHT * 100) return error(`สินค้านี้ราคาต่ำกว่าขั้นต่ำที่ชำระผ่าน PromptPay ได้ (฿${MIN_PRICE_BAHT}) กรุณาแจ้งร้านค้า`, 409);
    const admin = createAdminClient();
    // Sweep abandoned checkouts on new traffic as well as scheduled cleanup.
    await cleanupExpiredPromptpay(admin);
    let { data: context, error: readError } = await admin.from("stripe_checkout_contexts").select("*").eq("checkout_reference", reference).maybeSingle();
    if (readError) throw readError;
    if (context && (context.product_id !== body.productId || (context.promptpay_buyer_email && context.promptpay_buyer_email !== normalizedEmail) || (context.buyer_user_id && context.buyer_user_id !== user?.id))) return error("รายการชำระเงินไม่ตรงกับผู้ซื้อ", 409);
    if (!context) {
      // Cookie-authenticated RPC binds course identity at the database boundary.
      const { error: beginError } = await supabase.rpc("begin_stripe_product_checkout", { p_product_id: body.productId, p_checkout_reference: reference });
      if (beginError) return error(beginError.message.includes("sold_out") ? "สินค้าหมดแล้ว กรุณารีเฟรชหน้า" : "สินค้านี้ไม่พร้อมจำหน่าย", 409);
    }
    ({ data: context, error: readError } = await admin.from("stripe_checkout_contexts").select("*").eq("checkout_reference", reference).maybeSingle());
    if (readError || !context) throw new Error("Checkout unavailable");
    if (context.status === "cancelled") return error("รายการชำระเงินหมดอายุ กรุณาเริ่มใหม่", 409, "checkout_expired");
    if (context.status === "completed") return NextResponse.json({ url: `/checkout/success?session_id=${context.stripe_session_id}` }, { headers });
    // A free product needs no QR or card details. Preserve Stripe's authoritative
    // no_payment_required event and the existing fulfillment path.
    if (context.amount_cents === 0) {
      const stripe = getStripe();
      const origin = new URL(request.url).origin;
      const session = context.stripe_session_id
        ? await stripe.checkout.sessions.retrieve(context.stripe_session_id)
        : await stripe.checkout.sessions.create({
            mode: "payment", payment_method_types: ["card"],
            client_reference_id: reference, customer_email: normalizedEmail,
            line_items: [{ price_data: { currency: "thb", product_data: { name: product.name || "สินค้า" }, unit_amount: 0 }, quantity: 1 }],
            metadata: { checkout_reference: reference, purchase_kind: "product" },
            success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/checkout/cancelled`,
          }, { idempotencyKey: `free-checkout-${reference}` });
      if (!context.stripe_session_id) {
        const { error: attachError } = await admin.rpc("attach_stripe_checkout_session", { p_checkout_reference: reference, p_stripe_session_id: session.id });
        if (attachError) throw attachError;
      }
      if (session.status === "expired") return error("รายการชำระเงินหมดอายุ กรุณาเริ่มใหม่", 409, "checkout_expired");
      return NextResponse.json({ url: session.url || `/checkout/success?session_id=${session.id}` }, { headers });
    }
    const { error: prepareError } = await admin.rpc("prepare_promptpay_checkout", { p_checkout_reference: reference, p_email: normalizedEmail });
    if (prepareError) throw prepareError;
    ({ data: context, error: readError } = await admin.from("stripe_checkout_contexts").select("*").eq("checkout_reference", reference).maybeSingle());
    if (readError || !context) throw new Error("Checkout unavailable");
    if (context.status === "cancelled") return error("รายการชำระเงินหมดอายุ กรุณาเริ่มใหม่", 409, "checkout_expired");
    if (context.status === "completed") return NextResponse.json({ url: `/checkout/success?session_id=${context.stripe_session_id}` }, { headers });
    const stripe = getStripe();
    let intent = context.stripe_payment_intent_id
      ? await stripe.paymentIntents.retrieve(context.stripe_payment_intent_id)
      : await stripe.paymentIntents.create({
          amount: context.amount_cents, currency: "thb", payment_method_types: ["promptpay"],
          payment_method_data: { type: "promptpay", billing_details: { email: context.promptpay_buyer_email } },
          receipt_email: context.promptpay_buyer_email,
          metadata: { checkout_reference: reference, purchase_flow: "promptpay" },
        }, { idempotencyKey: `promptpay-create-${reference}` });
    // Bind before confirmation: even an immediate webhook cannot outrun this.
    const { error: attachError } = await admin.rpc("attach_promptpay_intent", { p_checkout_reference: reference, p_payment_intent_id: intent.id });
    if (attachError) throw attachError;
    if (intent.status === "requires_confirmation") intent = await stripe.paymentIntents.confirm(intent.id, {}, { idempotencyKey: `promptpay-confirm-${reference}` });
    if (intent.status === "canceled" || intent.status === "requires_payment_method") return error("รายการชำระเงินไม่สำเร็จ กรุณาเริ่มใหม่", 409, "checkout_expired");
    return NextResponse.json({ url: `/checkout/promptpay/${context.stripe_session_id}` }, { headers });
  } catch (failure) {
    // Only the code and message reach the logs, never request or buyer details.
    console.error("checkout failed", (failure as { code?: string })?.code, failure instanceof Error ? failure.message : "");
    // An API timeout is ambiguous. Keep the reservation and same idempotency key;
    // only a signed failure/cancel or confirmed server cancellation releases it.
    return error("ไม่สามารถเปิด QR ได้ กรุณาลองอีกครั้ง ระบบจะใช้รายการเดิม", 502);
  }
}
