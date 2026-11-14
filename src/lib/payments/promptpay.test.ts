import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:vi.fn()}));
const mocks=vi.hoisted(()=>({retrieve:vi.fn(),cancel:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/stripe',()=>({getStripe:()=>({paymentIntents:{retrieve:mocks.retrieve,cancel:mocks.cancel}})}));
import { expirePromptpay } from './promptpay';
const context={checkout_reference:'ref',stripe_session_id:'pp_receipt',stripe_payment_intent_id:'pi_bound',promptpay_expires_at:null,status:'created',amount_cents:10000};
const admin={rpc:mocks.rpc} as unknown as Parameters<typeof expirePromptpay>[1];
beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockResolvedValue({error:null});});
describe('safe QR expiry',()=>{
 it('preserves a delayed-prepared QR until its advertised expiry',async()=>{
   mocks.retrieve.mockResolvedValue({id:'pi_bound',status:'requires_action'});
   mocks.cancel.mockResolvedValue({id:'pi_bound',status:'canceled'});
   await expirePromptpay({...context,promptpay_expires_at:'2099-01-01T00:00:00Z'},admin);
   expect(mocks.retrieve).not.toHaveBeenCalled();
   expect(mocks.cancel).not.toHaveBeenCalled();
   expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('rechecks unbound state transactionally instead of trusting a stale snapshot',async()=>{
   await expirePromptpay({...context,stripe_payment_intent_id:null},admin);
   expect(mocks.rpc).toHaveBeenCalledWith('expire_unstarted_stripe_checkout',{p_checkout_reference:'ref'});
   expect(mocks.rpc).not.toHaveBeenCalledWith('cancel_stripe_checkout',expect.anything());
 });
 it.each(['succeeded','processing'])('retains the reservation when Stripe says %s',async(status)=>{mocks.retrieve.mockResolvedValue({id:'pi_bound',status});await expirePromptpay(context,admin);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.cancel).not.toHaveBeenCalled();});
 it('cancels Stripe before releasing a payable QR',async()=>{mocks.retrieve.mockResolvedValue({id:'pi_bound',status:'requires_action'});mocks.cancel.mockResolvedValue({id:'pi_bound',status:'canceled'});await expirePromptpay(context,admin);expect(mocks.rpc).toHaveBeenCalledWith('expire_promptpay_checkout',{p_checkout_reference:'ref',p_payment_intent_id:'pi_bound'});expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);});
 it('retains the reservation on an ambiguous cancellation timeout',async()=>{mocks.retrieve.mockResolvedValue({id:'pi_bound',status:'requires_action'});mocks.cancel.mockRejectedValue(new Error('timeout'));await expect(expirePromptpay(context,admin)).rejects.toThrow('timeout');expect(mocks.rpc).not.toHaveBeenCalled();});
});
