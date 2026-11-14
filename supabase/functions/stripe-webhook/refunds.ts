type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;

// Webhook snapshots can be stale and Charge.amount_refunded can include refunds
// that have not succeeded. Read all current refunds before updating access.
export async function reconcileStripeRefund(paymentIntentId: string, secret: string, rpc: Rpc, fetcher: typeof fetch = fetch) {
  if (!/^pi_[a-zA-Z0-9_]+$/.test(paymentIntentId)) throw new Error('Invalid payment intent');
  const observedAt = new Date().toISOString();
  async function get(path: string) {
    const response = await fetcher(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${secret}` } });
    if (!response.ok) throw new Error('Stripe refund lookup failed');
    return response.json();
  }
  const payment = await get(`payment_intents/${encodeURIComponent(paymentIntentId)}`);
  let refunded = 0;
  let after = '';
  for (;;) {
    const params = new URLSearchParams({ payment_intent: paymentIntentId, limit: '100' });
    if (after) params.set('starting_after', after);
    const page = await get(`refunds?${params}`);
    for (const refund of page.data) {
      if (refund.status === 'succeeded') refunded += refund.amount;
    }
    if (!page.has_more) break;
    const next = page.data.at(-1)?.id;
    if (!next || next === after) throw new Error('Invalid refund pagination');
    after = next;
  }
  const { error } = await rpc('sync_stripe_refund', {
    p_payment_intent_id: paymentIntentId,
    p_amount_cents: payment.amount_received,
    p_refunded_cents: refunded,
    p_observed_at: observedAt,
  });
  if (error) throw new Error('Unable to save refund');
}
