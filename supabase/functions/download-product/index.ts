import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createDownloadHandler } from './handler.ts';

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response('Storage configuration is incomplete', { status: 500 });
  const admin = createClient(url, serviceKey, { db: { schema: Deno.env.get('BUYKUB_DB_SCHEMA') || 'buykub' } });
  return createDownloadHandler({
    async findPurchase(sessionId) {
      const { data: context, error } = await admin.from('stripe_checkout_contexts').select('status,kind,order_id,product_id,shop_id').eq('stripe_session_id', sessionId).maybeSingle();
      if (error) throw error;
      if (!context) return null;
      const [order, product, shop] = await Promise.all([
        context.order_id ? admin.from('orders').select('status,stripe_checkout_session_id').eq('id', context.order_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        context.product_id ? admin.from('products').select('delivery_type,file_path,file_name').eq('id', context.product_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        admin.from('shops').select('owner_id').eq('id', context.shop_id).maybeSingle(),
      ]);
      if (order.error || product.error || shop.error) throw new Error('Purchase lookup failed');
      return {
        status: context.status, kind: context.kind,
        order: order.data ? { status: order.data.status, sessionId: order.data.stripe_checkout_session_id } : null,
        product: product.data ? { deliveryType: product.data.delivery_type, filePath: product.data.file_path, fileName: product.data.file_name } : null,
        ownerId: shop.data?.owner_id ?? null,
      };
    },
    async sign(path, expiresIn, fileName) {
      const { data, error } = await admin.storage.from('product-files').createSignedUrl(path, expiresIn, { download: fileName });
      if (error || !data?.signedUrl) throw new Error('File signing failed');
      return data.signedUrl;
    },
  })(request);
});
