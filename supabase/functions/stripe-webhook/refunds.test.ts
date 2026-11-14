import { describe, expect, it, vi } from 'vitest';
import { reconcileStripeRefund } from './refunds';

describe('authoritative refund totals', () => {
  it('aggregates only successful refunds across all pages, without treating partial or pending refunds as full', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({amount_received:10000,currency:'thb'}))
      .mockResolvedValueOnce(Response.json({data:[{id:'re_a',amount:2000,status:'succeeded'},{id:'re_b',amount:5000,status:'pending'}],has_more:true}))
      .mockResolvedValueOnce(Response.json({data:[{id:'re_c',amount:1000,status:'succeeded'},{id:'re_d',amount:2000,status:'failed'}],has_more:false}));
    const rpc = vi.fn().mockResolvedValue({error:null});
    await reconcileStripeRefund('pi_test','sk_test',rpc,fetcher);
    expect(rpc).toHaveBeenCalledWith('sync_stripe_refund',expect.objectContaining({p_payment_intent_id:'pi_test',p_amount_cents:10000,p_refunded_cents:3000}));
    expect(String(fetcher.mock.calls[2][0])).toContain('starting_after=re_b');
  });
  it('does not commit a partial snapshot when Stripe pagination fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({amount_received:10000})).mockResolvedValueOnce(new Response('offline',{status:500}));
    const rpc = vi.fn();
    await expect(reconcileStripeRefund('pi_test','sk_test',rpc,fetcher)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
