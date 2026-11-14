import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({context:vi.fn(),retrieve:vi.fn(),expire:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:mocks.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.context})})})})}));
vi.mock('@/lib/stripe',()=>({getStripe:()=>({paymentIntents:{retrieve:mocks.retrieve}})}));
vi.mock('@/lib/payments/promptpay',()=>({expirePromptpay:mocks.expire}));
import { GET } from './route';
const receipt='pp_11111111-1111-4111-8111-111111111111';
const context={checkout_reference:'ref',stripe_session_id:receipt,stripe_payment_intent_id:'pi_bound',promptpay_expires_at:'2099-01-01T00:00:00Z',status:'created',amount_cents:38900,products:{name:'Book'}};
const request=()=>new Request(`https://example.com/api/stripe/promptpay?receipt=${receipt}`);
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({data:context});mocks.retrieve.mockResolvedValue({status:'requires_action',livemode:false,next_action:{promptpay_display_qr_code:{image_url_png:'https://stripe.example/qr.png',hosted_instructions_url:'https://stripe.example/instructions'}}});});
describe('read-only QR status',()=>{
 it('returns the bound QR and stored amount without exposing a client secret',async()=>{const response=await GET(request());const result=await response.json();expect(result.qrUrl).toBe('https://stripe.example/qr.png');expect(result.amountCents).toBe(38900);expect(result.client_secret).toBeUndefined();expect(mocks.retrieve).toHaveBeenCalledWith('pi_bound');});
 it('waits for webhook fulfillment even if Stripe has received the money',async()=>{mocks.retrieve.mockResolvedValue({status:'succeeded'});expect(await (await GET(request())).json()).toEqual({status:'processing',receiptUrl:`/checkout/success?session_id=${receipt}`});expect(mocks.rpc).not.toHaveBeenCalled();});
 it('does not display an expired QR after confirmed cancellation',async()=>{mocks.context.mockResolvedValue({data:{...context,promptpay_expires_at:'2000-01-01T00:00:00Z'}});mocks.retrieve.mockResolvedValueOnce({status:'requires_action'}).mockResolvedValueOnce({status:'canceled'});expect(await (await GET(request())).json()).toEqual({status:'expired'});expect(mocks.expire).toHaveBeenCalled();});
 it('rejects arbitrary intent IDs instead of querying Stripe',async()=>{expect((await GET(new Request('https://example.com/api/stripe/promptpay?receipt=pi_other'))).status).toBe(400);expect(mocks.retrieve).not.toHaveBeenCalled();});
});
