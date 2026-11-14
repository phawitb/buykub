import { describe, expect, it, vi } from 'vitest';
import { createProductEmailHandler } from './handler';
const id='12345678-1234-4123-8123-123456789abc';
const token='12345678-1234-4123-8123-123456789abd';
function setup() {
  const delivery = {buyer_email:'real@example.com',status:'paid',session_id:'cs_test_receipt',product_name:'Guide',shop_name:'Shop',key_value:null};
  const lookup=vi.fn().mockResolvedValue(delivery);
  const rpc=vi.fn().mockImplementation(async(name,args)=>({data:name==='claim_product_email'?{status:'claimed',lease:'lease',payload:args.p_payload}:null,error:null}));
  const send=vi.fn().mockResolvedValue(Response.json({id:'email_1'}));
  const handler=createProductEmailHandler({serviceKey:'server-secret',from:'BUYKUB <orders@mail.buykub.com>',replyTo:'support@buykub.com',lookup,rpc,send});
  const request=(auth='server-secret')=>new Request('https://example.com',{method:'POST',headers:{authorization:`Bearer ${auth}`},body:JSON.stringify({orderId:id,emailToken:token,to:'attacker@example.com',url:'https://evil.com'})});
  return {delivery,lookup,rpc,send,handler,request};
}
describe('paid product email delivery',()=>{
  it('sends a course login link instead of a file download for paid courses',async()=>{
    const {handler,request,send,lookup,delivery}=setup();
    lookup.mockResolvedValue({...delivery,delivery_type:'course',product_id:id,course_expires_at:null});
    expect((await handler(request())).status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({text:expect.stringContaining(`/learn/${id}`)}),`product-delivery-${id}`);
    expect(send.mock.calls[0][0].text).not.toContain('/checkout/success');
  });
  it('sends file receipt to the stored buyer only and records provider success',async()=>{
    const {handler,request,send,rpc}=setup();
    expect((await handler(request())).status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({to:['real@example.com'],text:expect.stringContaining('https://buykub.com/checkout/success?session_id=cs_test_receipt')}),`product-delivery-${id}`);
    expect(rpc).toHaveBeenCalledWith('finish_product_email',expect.objectContaining({p_provider_id:'email_1',p_lease:'lease'}));
  });
  it('requires service authentication before reading any order',async()=>{
    const {handler,request,lookup}=setup();expect((await handler(request('bad'))).status).toBe(401);expect(lookup).not.toHaveBeenCalled();
  });
  it('never sends unpaid or refunded orders',async()=>{
    const {handler,request,lookup,delivery,send}=setup();lookup.mockResolvedValue({...delivery,status:'refunded'});
    expect((await handler(request())).status).toBe(409);expect(send).not.toHaveBeenCalled();
  });
  it('returns retryable failure for provider rejection',async()=>{
    const {handler,request,send}=setup();send.mockResolvedValue(new Response('bad',{status:503}));expect((await handler(request())).status).toBe(502);
  });
  it('does not resend an already sent delivery',async()=>{
    const {handler,request,rpc,send}=setup();rpc.mockResolvedValue({data:{status:'sent'},error:null});
    expect((await handler(request())).status).toBe(200);expect(send).not.toHaveBeenCalled();
  });
  it('retries using the immutable stored payload after a product changes',async()=>{
    const {handler,request,rpc,send}=setup();rpc.mockResolvedValue({data:{status:'claimed',lease:'lease',payload:{to:['real@example.com'],text:'original receipt'}},error:null});
    expect((await handler(request())).status).toBe(200);expect(send).toHaveBeenCalledWith({to:['real@example.com'],text:'original receipt'},`product-delivery-${id}`);
  });
  it('reports a failed database acknowledgement so delivery is retried safely',async()=>{
    const {handler,request,rpc}=setup();rpc.mockImplementation(async(name,args)=>name==='finish_product_email'?{data:null,error:'offline'}:{data:{status:'claimed',lease:'lease',payload:args.p_payload},error:null});
    expect((await handler(request())).status).toBe(500);
  });
  it('does not send while another attempt is active or the safe retry window expired',async()=>{
    for (const status of ['busy','review_required']) {
      const {handler,request,rpc,send}=setup();rpc.mockResolvedValue({data:{status},error:null});
      expect((await handler(request())).status).toBe(503);expect(send).not.toHaveBeenCalled();
    }
  });
});

it('keeps assigned product-key delivery',async()=>{
  const {handler,request,lookup,delivery,send}=setup();lookup.mockResolvedValue({...delivery,key_value:'KEY-1234'});
  expect((await handler(request())).status).toBe(200);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({text:expect.stringContaining('KEY-1234')}),`product-delivery-${id}`);
});

it('allows a verified owner to retry using only the order ID and resolves the token on the server',async()=>{
  const lookup=vi.fn().mockResolvedValue({buyer_email:'real@example.com',status:'paid',session_id:'cs_test_receipt',product_name:'Guide',shop_name:'Shop',key_value:null});
  const resolveOwnerToken=vi.fn().mockResolvedValue(token);
  const handler=createProductEmailHandler({serviceKey:'server-secret',from:'Shop',replyTo:'support@buykub.com',lookup,resolveOwnerToken,
    rpc:async()=>({data:{status:'sent'},error:null}),send:vi.fn()});
  const response=await handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer seller-jwt'},body:JSON.stringify({orderId:id})}));
  expect(response.status).toBe(200);
  expect(resolveOwnerToken).toHaveBeenCalledWith('Bearer seller-jwt',id);
  expect(lookup).toHaveBeenCalledWith(id,token);
});

it('rejects a seller without order ownership before reading delivery content',async()=>{
  const lookup=vi.fn();
  const handler=createProductEmailHandler({serviceKey:'server-secret',from:'Shop',replyTo:'support@buykub.com',lookup,resolveOwnerToken:async()=>null,rpc:vi.fn(),send:vi.fn()});
  expect((await handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer other-seller'},body:JSON.stringify({orderId:id,emailToken:token})}))).status).toBe(403);
  expect(lookup).not.toHaveBeenCalled();
});
