import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createProductEmailHandler } from './handler.ts';

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!url || !serviceKey || !resendKey || !from) return new Response('Email configuration is incomplete', {status:503});
  const admin = createClient(url,serviceKey,{db:{schema:Deno.env.get('BUYKUB_DB_SCHEMA') || 'buykub'}});
  return createProductEmailHandler({
    serviceKey, from, replyTo:Deno.env.get('RESEND_REPLY_TO_EMAIL') || 'support@buykub.com',
    async resolveOwnerToken(authorization, orderId) {
      const {data:{user},error:authError} = await admin.auth.getUser(authorization.slice(7));
      if (authError || !user) return null;
      const {data,error} = await admin.from('orders').select('fulfilment_token, shops!inner(owner_id)')
        .eq('id',orderId).eq('status','paid').eq('payment_method','stripe').eq('shops.owner_id',user.id).maybeSingle();
      if (error) throw error;
      return data?.fulfilment_token ?? null;
    },
    async lookup(order, token) {
      const {data,error} = await admin.rpc('get_product_email_delivery',{p_order_id:order,p_email_token:token});
      if (error) throw error;
      return data;
    },
    rpc: (name,args) => admin.rpc(name,args),
    send: (payload,key) => fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),
      signal:AbortSignal.timeout(20000),
    }),
  })(request);
});
