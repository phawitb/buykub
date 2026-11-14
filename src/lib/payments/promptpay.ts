import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

type Admin = ReturnType<typeof createAdminClient>;
export type PromptpayContext = {
  checkout_reference: string; stripe_session_id: string; stripe_payment_intent_id: string | null;
  promptpay_expires_at: string | null; status: string; amount_cents: number;
};
export async function expirePromptpay(context: PromptpayContext, admin: Admin) {
  if (context.status !== "created") return;
  // Preparation can be retried after the context was first created; honor the
  // QR deadline shown to the buyer, not the age of that earlier context.
  if (context.promptpay_expires_at && new Date(context.promptpay_expires_at).getTime() > Date.now()) return;
  if (context.stripe_payment_intent_id) {
    const stripe = getStripe();
    let intent = await stripe.paymentIntents.retrieve(context.stripe_payment_intent_id, {}, { timeout: 3000, maxNetworkRetries: 0 });
    if (intent.status === "succeeded" || intent.status === "processing") return;
    if (intent.status !== "canceled") intent = await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `promptpay-expire-${context.checkout_reference}`, timeout: 3000, maxNetworkRetries: 0 });
    if (intent.status !== "canceled") return;
    const { error } = await admin.rpc("expire_promptpay_checkout", { p_checkout_reference: context.checkout_reference, p_payment_intent_id: intent.id });
    if (error) throw error;
  } else {
    // The snapshot may be stale. SQL locks and rechecks the current intent,
    // hosted session, status and expiry before releasing the reservation.
    const { error } = await admin.rpc("expire_unstarted_stripe_checkout", { p_checkout_reference: context.checkout_reference });
    if (error) throw error;
  }
}
export async function cleanupExpiredPromptpay(admin = createAdminClient()) {
  const { data, error } = await admin.from("stripe_checkout_contexts").select("checkout_reference,stripe_session_id,stripe_payment_intent_id,promptpay_expires_at,status,amount_cents")
    .eq("status", "created").lt("created_at", new Date(Date.now() - 3600_000).toISOString())
    .or("stripe_session_id.is.null,stripe_session_id.like.pp_%").limit(3);
  if (error) throw error;
  for (const context of data ?? []) {
    // A single upstream outage must not release stock or block other cleanups.
    try { await expirePromptpay(context as PromptpayContext, admin); } catch { /* Retry on next sweep. */ }
  }
}
