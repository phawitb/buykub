import { buildCourseEmail, buildProductFileEmail, buildProductKeyEmail } from './email.ts';
type Delivery = { buyer_email: string; status: string; session_id: string; product_name: string; shop_name: string; key_value: string | null; delivery_type?: string; product_id?: string; course_expires_at?: string | null };
type Dependencies = {
  serviceKey: string; from: string; replyTo: string;
  resolveOwnerToken?: (authorization: string, order: string) => Promise<string | null>;
  lookup: (order: string, token: string) => Promise<Delivery | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  send: (payload: Record<string, unknown>, idempotencyKey: string) => Promise<Response>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json = (body: unknown, status = 200) => Response.json(body, {status,headers:cors});

export function createProductEmailHandler(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok',{headers:cors});
    if (request.method !== 'POST') return json({error:'Method not allowed'},405);
    const authorization = request.headers.get('authorization') || '';
    const internal = authorization === `Bearer ${deps.serviceKey}`;
    if (!internal && (!authorization.startsWith('Bearer ') || !deps.resolveOwnerToken)) return json({error:'Unauthorized'},401);
    try {
      const body = await request.json();
      if (!uuid.test(body.orderId)) return json({error:'Invalid order reference'},400);
      const emailToken = internal ? body.emailToken : await deps.resolveOwnerToken!(authorization,body.orderId);
      if (!internal && !emailToken) return json({error:'Order access denied'},403);
      if (!uuid.test(emailToken)) return json({error:'Invalid delivery reference'},400);
      const order = await deps.lookup(body.orderId, emailToken);
      if (!order) return json({error:'Delivery not found'},404);
      if (order.status !== 'paid') return json({error:'Order is not paid'},409);
      const input = {shopName:order.shop_name,productName:order.product_name,orderId:body.orderId};
      if (order.delivery_type === 'course' && !order.product_id) return json({error:'Course delivery is not configured'},500);
      const email = order.delivery_type === 'course'
        ? buildCourseEmail({...input,productId:order.product_id!,expiresAt:order.course_expires_at ?? null})
        : order.key_value
        ? buildProductKeyEmail({...input,keyValue:order.key_value})
        : buildProductFileEmail({...input,sessionId:order.session_id});
      const payload = {from:deps.from,reply_to:deps.replyTo,to:[order.buyer_email],...email};
      const claimed = await deps.rpc('claim_product_email',{p_order_id:body.orderId,p_email_token:emailToken,p_payload:payload});
      if (claimed.error) throw new Error('Unable to claim delivery');
      const claim = claimed.data as {status:string;lease?:string;payload?:Record<string,unknown>};
      if (claim.status === 'sent' || claim.status === 'revoked') return json({emailStatus:claim.status});
      if (claim.status !== 'claimed' || !claim.payload) return json({emailStatus:claim.status},503);
      let response: Response;
      try {
        response = await deps.send(claim.payload,`product-delivery-${body.orderId}`);
      } catch {
        // Ambiguous network failures retain the lease and original request. Retry
        // with the same provider key after the lease, within its retention window.
        return json({emailStatus:'retry'},502);
      }
      if (!response.ok) {
        const finished = await deps.rpc('finish_product_email',{p_order_id:body.orderId,p_lease:claim.lease,p_provider_id:null,p_error:`Resend HTTP ${response.status}`});
        if (finished.error) throw new Error('Unable to save delivery failure');
        return json({emailStatus:'failed'},502);
      }
      const result = await response.json();
      if (!result.id) throw new Error('Missing provider receipt');
      const finished = await deps.rpc('finish_product_email',{p_order_id:body.orderId,p_lease:claim.lease,p_provider_id:result.id,p_error:null});
      if (finished.error) throw new Error('Unable to acknowledge delivery');
      return json({emailStatus:'sent'});
    } catch {
      return json({error:'Unable to deliver email'},500);
    }
  };
}
