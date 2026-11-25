-- Isolated database only. All fixture rows roll back.
begin;
do $$
declare
  seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); shop uuid:=gen_random_uuid();
  free uuid:=gen_random_uuid(); paid uuid:=gen_random_uuid();
  ref uuid:=gen_random_uuid(); paid_ref uuid:=gen_random_uuid(); first record; again record; denied boolean;
begin
  insert into auth.users(id,email,email_confirmed_at) values(seller,'seller@example.com',now()),(buyer,'buyer@example.com',now());
  insert into buykub.profiles(id) values(seller),(buyer);
  insert into buykub.shops(id,owner_id,slug,name,published) values(shop,seller,'free-'||shop,'Free shop',true);
  insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published) values
    (free,shop,'free','Free course',0,'course',true),(paid,shop,'paid','Paid course',10000,'course',true);
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform set_config('request.jwt.claims','{"app_metadata":{"provider":"google","providers":["google"]}}',true);
  perform buykub.begin_stripe_product_checkout(free,ref);
  perform buykub.begin_stripe_product_checkout(paid,paid_ref);

  select * into first from buykub.finalize_free_checkout(ref,'buyer@example.com');
  assert first.kind='product' and first.order_id is not null,'free claim creates an order';
  assert (select stripe_session_id like 'pp_%' and status='completed' from buykub.stripe_checkout_contexts where checkout_reference=ref),'free claim gets a pp_ receipt';
  assert (select status='paid' and price_cents=0 and buyer_user_id=buyer from buykub.orders where id=first.order_id),'free order is bound to the buyer';
  select * into again from buykub.finalize_free_checkout(ref,'buyer@example.com');
  assert again.order_id=first.order_id,'a retry returns the same order';
  assert (select count(*)=1 from buykub.orders where product_id=free),'a retry creates no second order';

  denied:=false;
  begin perform buykub.finalize_free_checkout(paid_ref,'buyer@example.com'); exception when others then denied:=true; end;
  assert denied,'a paid product cannot be claimed free';
  assert (select count(*)=0 from buykub.orders where product_id=paid),'a refused claim grants nothing';
end $$;
rollback;
