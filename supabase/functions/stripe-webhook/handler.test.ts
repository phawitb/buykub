import { createHmac, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createStripeWebhookHandler } from './handler';

vi.stubGlobal('crypto', webcrypto);
const secret = 'test-webhook-secret';
function request(type = 'checkout.session.completed', paymentStatus = 'paid', valid = true) {
  const payload = JSON.stringify({ type, livemode: false, data: { object: { id: 'cs_test_valid', payment_status: paymentStatus, metadata: { checkout_reference: 'reference' }, customer_details: { email: 'buyer@example.com', name: 'Test Buyer' }, payment_intent: 'pi_test' } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return new Request('https://example.com/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${timestamp},v1=${valid ? signature : 'invalid'}` } });
}
function setup() {
  const rpc = vi.fn().mockResolvedValue({ data: [{ kind: 'product', order_id: 'order', email_token: null }], error: null });
  const dispatch = vi.fn().mockResolvedValue(undefined);
  return { rpc, dispatch, handler: createStripeWebhookHandler({ secret, stripeSecretKey: 'sk_test_fixture', rpc, dispatch }) };
}
describe('Stripe webhook fulfillment', () => {
  it('rejects invalid signatures without touching the database', async () => {
    const { handler, rpc } = setup();
    expect((await handler(request(undefined, undefined, false))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not fulfill a completed session while its payment is unpaid', async () => {
    const { handler, rpc } = setup();
    expect((await handler(request(undefined, 'unpaid'))).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('fulfills a verified paid session through the idempotent database RPC', async () => {
    const { handler, rpc, dispatch } = setup();
    expect((await handler(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout', expect.objectContaining({ p_stripe_session_id: 'cs_test_valid', p_checkout_reference: 'reference' }));
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('returns a retryable error if finalization fails', async () => {
    const { handler, rpc } = setup(); rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    expect((await handler(request())).status).toBe(500);
  });
  it('returns a retryable error if expiration fails', async () => {
    const { handler, rpc } = setup(); rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    expect((await handler(request('checkout.session.expired', 'unpaid'))).status).toBe(500);
  });
  it('expires failed asynchronous payments so reservations can be released', async () => {
    const { handler, rpc } = setup();
    expect((await handler(request('checkout.session.async_payment_failed', 'unpaid'))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('expire_stripe_checkout', { p_stripe_session_id: 'cs_test_valid' });
  });
});

function eventRequest(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ type, livemode: false, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  return new Request('https://example.com/webhook', { method:'POST', body:payload, headers:{ 'stripe-signature':`t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}` } });
}
describe('retryable delivery and refunds', () => {
  it('retries email delivery on a duplicate paid event after provider failure', async () => {
    const { handler, rpc, dispatch } = setup();
    rpc.mockResolvedValue({data:[{kind:'product',order_id:'order',email_token:'token'}],error:null});
    dispatch.mockResolvedValueOnce(new Response('failed',{status:502})).mockResolvedValueOnce(new Response('ok'));
    expect((await handler(request())).status).toBe(500);
    expect((await handler(request())).status).toBe(200);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
  it.each(['charge.refunded','refund.created','refund.updated','refund.failed'])('reconciles %s from authoritative Stripe data', async type => {
    const rpc = vi.fn().mockResolvedValue({data:null,error:null});
    const reconcileRefund = vi.fn().mockResolvedValue(undefined);
    const handler = createStripeWebhookHandler({secret,stripeSecretKey:'sk_test_fixture',rpc,dispatch:vi.fn(),reconcileRefund});
    expect((await handler(eventRequest(type,{id:'refund-or-charge',payment_intent:'pi_test'}))).status).toBe(200);
    expect(reconcileRefund).toHaveBeenCalledWith('pi_test');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('asks Stripe to retry when refund reconciliation fails', async () => {
    const handler = createStripeWebhookHandler({secret,stripeSecretKey:'sk_test_fixture',rpc:vi.fn(),dispatch:vi.fn(),reconcileRefund:async()=>{throw new Error('offline');}});
    expect((await handler(eventRequest('refund.updated',{id:'re_1',payment_intent:'pi_test'}))).status).toBe(500);
  });
});

describe('native PromptPay fulfillment', () => {
  const payment = { id:'pi_promptpay', status:'succeeded', amount:38900, amount_received:38900, currency:'thb', receipt_email:'buyer@example.com', metadata:{checkout_reference:'reference', purchase_flow:'promptpay'} };
  it('binds successful payment ID, amount and currency before fulfillment', async () => {
    const {handler,rpc} = setup();
    expect((await handler(eventRequest('payment_intent.succeeded',payment))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('finalize_promptpay_checkout',{p_checkout_reference:'reference',p_payment_intent_id:'pi_promptpay',p_amount_cents:38900,p_currency:'thb'});
  });
  it('never fulfills an unpaid or underpaid intent', async () => {
    const {handler,rpc} = setup();
    await handler(eventRequest('payment_intent.succeeded',{...payment,amount_received:100}));
    await handler(eventRequest('payment_intent.succeeded',{...payment,status:'requires_action'}));
    expect(rpc).not.toHaveBeenCalled();
  });
  it('releases reservations only for the bound failed or cancelled intent', async () => {
    const {handler,rpc} = setup();
    await handler(eventRequest('payment_intent.canceled',{...payment,status:'canceled'}));
    expect(rpc).toHaveBeenCalledWith('expire_promptpay_checkout',{p_checkout_reference:'reference',p_payment_intent_id:'pi_promptpay'});
  });
  it('ignores PaymentIntents belonging to legacy hosted checkout', async () => {
    const {handler,rpc} = setup();
    await handler(eventRequest('payment_intent.succeeded',{...payment,metadata:{checkout_reference:'reference'}}));
    expect(rpc).not.toHaveBeenCalled();
  });
});


describe('Stripe environment isolation', () => {
  function signedPayment(livemode: unknown, validSignature = true, type = 'payment_intent.succeeded') {
    const payload = JSON.stringify({
      id: 'evt_fixture', object: 'event', api_version: '2026-06-24.dahlia',
      created: Math.floor(Date.now() / 1000), livemode, pending_webhooks: 1,
      request: { id: null, idempotency_key: null }, type,
      data: { object: {
        id: 'pi_fixture', object: 'payment_intent', livemode,
        status: 'succeeded', amount: 38900, amount_received: 38900, currency: 'thb',
        payment_intent: 'pi_fixture',
        metadata: { checkout_reference: 'fbc4ac91-0521-46e3-b854-832ff9b0ed81', purchase_flow: 'promptpay' },
      } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    return new Request('https://example.com/webhook', { method: 'POST', body: payload,
      headers: { 'stripe-signature': `t=${timestamp},v1=${validSignature ? signature : 'invalid'}` } });
  }
  function environment(stripeSecretKey: string | undefined) {
    const rpc = vi.fn().mockResolvedValue({ data: [{ kind: 'product', order_id: 'order', email_token: 'token' }], error: null });
    const dispatch = vi.fn().mockResolvedValue(new Response('ok'));
    const reconcileRefund = vi.fn().mockResolvedValue(undefined);
    return { rpc, dispatch, reconcileRefund, handler: createStripeWebhookHandler({ secret, stripeSecretKey, rpc, dispatch, reconcileRefund }) };
  }
  it.each([
    ['sk_live_fixture', true], ['rk_live_fixture', true],
    ['sk_test_fixture', false], ['rk_test_fixture', false],
  ])('fulfills signed events matching %s', async (key, livemode) => {
    const { handler, rpc, dispatch } = environment(key as string);
    expect((await handler(signedPayment(livemode))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('finalize_promptpay_checkout', expect.objectContaining({ p_payment_intent_id: 'pi_fixture' }));
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it.each([
    ['sk_live_fixture', false], ['rk_live_fixture', false],
    ['sk_test_fixture', true], ['rk_test_fixture', true],
    ['sk_live_fixture', undefined], ['sk_live_fixture', 'true'],
  ])('rejects incorrect or absent event mode with %s and %s', async (key, livemode) => {
    const { handler, rpc, dispatch, reconcileRefund } = environment(key as string);
    for (const type of ['payment_intent.succeeded', 'payment_intent.canceled', 'refund.updated', 'checkout.session.completed']) {
      expect((await handler(signedPayment(livemode, true, type))).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(reconcileRefund).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'pk_live_fixture', 'sk_live_', 'unknown'])('fails closed for missing or invalid API key %s', async key => {
    const { handler, rpc, dispatch, reconcileRefund } = environment(key);
    expect((await handler(signedPayment(true))).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(reconcileRefund).not.toHaveBeenCalled();
  });
  it('still validates the signature before reporting configuration errors', async () => {
    const { handler, rpc } = environment(undefined);
    expect((await handler(signedPayment(true, false))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
