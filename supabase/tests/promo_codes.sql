-- Isolated database only. All fixture rows roll back.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select gen_random_uuid() seller, gen_random_uuid() alice, gen_random_uuid() bob, gen_random_uuid() carol,
  gen_random_uuid() shop, gen_random_uuid() product, gen_random_uuid() other_product, gen_random_uuid() other_shop \gset
insert into auth.users(id,email,email_confirmed_at) values
  (:'seller','seller@example.com',now()),(:'alice','alice@example.com',now()),(:'bob','bob@example.com',now()),(:'carol','carol@example.com',now());
insert into buykub.profiles(id) values(:'seller'),(:'alice'),(:'bob'),(:'carol');
insert into buykub.shops(id,owner_id,slug,name,published) values(:'shop',:'seller','promo-'||:'shop','Promo shop',true),
  (:'other_shop',:'carol','promo-'||:'other_shop','Other shop',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published,affiliate_rate_bp) values
  (:'product',:'shop','guide','Guide',18900,'file',true,1000),(:'other_product',:'shop','other','Other',8900,'file',true,null);
select set_config('request.jwt.claims','{"app_metadata":{"provider":"google","providers":["google"]}}',false),
  set_config('test.seller',:'seller',false),set_config('test.alice',:'alice',false),set_config('test.bob',:'bob',false),
  set_config('test.carol',:'carol',false),set_config('test.shop',:'shop',false),set_config('test.product',:'product',false),
  set_config('test.other_product',:'other_product',false),set_config('test.other_shop',:'other_shop',false);

-- Starts a checkout as p_user, with an optional code and referral; returns the reference.
create function pg_temp.start(p_user uuid, p_product uuid, p_promo text, p_ref text default null) returns uuid language plpgsql as $$
declare ref uuid:=gen_random_uuid();
begin
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  if p_promo is null then perform buykub.begin_stripe_product_checkout(p_product,ref);
  else perform buykub.begin_product_checkout_with_promo(p_product,ref,p_promo); end if;
  perform buykub.attach_checkout_referral(ref,p_ref);
  return ref;
end $$;
-- Pays an open checkout through PromptPay for whatever amount it holds.
create function pg_temp.pay(p_user uuid, ref uuid, p_intent text) returns uuid language plpgsql as $$
declare r record; amt integer;
begin
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform buykub.prepare_promptpay_checkout(ref,(select email from auth.users where id=p_user));
  perform buykub.attach_promptpay_intent(ref,p_intent);
  select amount_cents into amt from buykub.stripe_checkout_contexts where checkout_reference=ref;
  select * into r from buykub.finalize_promptpay_checkout(ref,p_intent,amt,'thb');
  return r.order_id;
end $$;
create function pg_temp.refused(p_user uuid, p_product uuid, p_promo text) returns text language plpgsql as $$
begin
  perform pg_temp.start(p_user,p_product,p_promo);
  return 'allowed';
exception when others then return sqlerrm;
end $$;

do $$
declare
  seller uuid:=current_setting('test.seller'); alice uuid:=current_setting('test.alice'); bob uuid:=current_setting('test.bob');
  carol uuid:=current_setting('test.carol'); shop uuid:=current_setting('test.shop'); product uuid:=current_setting('test.product');
  other_product uuid:=current_setting('test.other_product'); other_shop uuid:=current_setting('test.other_shop');
  ref uuid; o uuid; q record; denied boolean; aff_code text; open_ref uuid;
begin
  insert into buykub.promo_codes(shop_id,code,percent_off,product_ids) values(shop,' save20 ',20,array[product]);
  insert into buykub.promo_codes(shop_id,code,amount_off_cents,max_redemptions) values(shop,'BAHT50',5000,2);
  insert into buykub.promo_codes(shop_id,code,amount_off_cents,once_per_user) values(shop,'ONCE',1000,true);
  insert into buykub.promo_codes(shop_id,code,percent_off) values(shop,'FREE',100);
  insert into buykub.promo_codes(shop_id,code,amount_off_cents) values(shop,'NEARLY',8000);
  insert into buykub.promo_codes(shop_id,code,percent_off,expires_at) values(shop,'OLD',10,now()-interval '1 minute');
  insert into buykub.promo_codes(shop_id,code,percent_off,active) values(shop,'OFF',10,false);

  -- Codes are stored upper case and limited to the shop's own products.
  assert exists(select 1 from buykub.promo_codes where code='SAVE20'),'code normalised';
  denied:=false; begin insert into buykub.promo_codes(shop_id,code,percent_off,product_ids) values(other_shop,'STEAL',10,array[product]);
  exception when check_violation then denied:=true; end;
  assert denied,'cannot name another shop''s product';
  denied:=false; begin insert into buykub.promo_codes(shop_id,code,percent_off,amount_off_cents) values(shop,'BOTH',10,100);
  exception when check_violation then denied:=true; end;
  assert denied,'percent or amount, not both';

  -- Quote: 20% of ฿189 is ฿37.80, rounded down to ฿37 off.
  perform set_config('request.jwt.claim.sub',alice::text,true);
  select * into q from buykub.quote_promo_code(product,'save20');
  assert q.discount_cents=3700 and q.final_cents=15200 and q.list_cents=18900,'percent quote';
  assert pg_temp.refused(alice,other_product,'SAVE20')='promo_not_for_product','product list enforced';
  assert pg_temp.refused(alice,product,'OLD')='promo_expired','expired';
  assert pg_temp.refused(alice,product,'OFF')='promo_invalid','inactive';
  assert pg_temp.refused(alice,product,'NOPE')='promo_invalid','unknown';
  assert pg_temp.refused(alice,other_product,'NEARLY')='promo_below_minimum','between ฿0 and ฿10 refused';
  -- A refusal leaves no checkout behind.
  assert not exists(select 1 from buykub.stripe_checkout_contexts where buyer_user_id=alice),'refusal rolls back';

  -- Paid with a code: the order, and so the payout and fee, follow the discounted price.
  ref:=pg_temp.start(alice,product,'save20');
  o:=pg_temp.pay(alice,ref,'pi_alice');
  assert (select price_cents from buykub.orders where id=o)=15200,'order at discounted price';
  assert (select discount_cents from buykub.stripe_checkout_contexts where checkout_reference=ref)=3700,'discount kept';

  -- Discount and referral together: commission on what the buyer paid.
  aff_code:=(select buykub.get_affiliate_link(product));
  ref:=pg_temp.start(bob,product,'SAVE20',aff_code);
  o:=pg_temp.pay(bob,ref,'pi_bob');
  assert (select amount_cents from buykub.affiliate_commissions where order_id=o)=1520,'10% of ฿152';

  -- Total uses: an open checkout holds a use; a cancelled one gives it back.
  open_ref:=pg_temp.start(alice,product,'BAHT50');
  ref:=pg_temp.start(bob,product,'BAHT50');
  assert pg_temp.refused(carol,product,'BAHT50')='promo_used_up','limit of 2';
  perform buykub.cancel_stripe_checkout(open_ref);
  assert pg_temp.refused(carol,product,'BAHT50')='allowed','cancelled checkout frees a use';

  -- Once per account.
  ref:=pg_temp.start(alice,product,'ONCE');
  assert pg_temp.refused(alice,product,'ONCE')='promo_already_used','once per user';
  assert pg_temp.refused(bob,product,'ONCE')='allowed','other users still can';

  -- 100% off is a free checkout.
  ref:=pg_temp.start(carol,other_product,'FREE');
  assert (select amount_cents from buykub.stripe_checkout_contexts where checkout_reference=ref)=0,'free';

  -- Only the owner sees usage and order discounts.
  perform set_config('request.jwt.claim.sub',seller::text,true);
  assert (select paid_uses from buykub.my_promo_code_usage() u join buykub.promo_codes c on c.id=u.promo_id where c.code='SAVE20')=2,'usage';
  assert (select discount_cents from buykub.shop_order_discount(o))=3700,'owner sees order discount';
  perform set_config('request.jwt.claim.sub',carol::text,true);
  assert not exists(select 1 from buykub.my_promo_code_usage()),'other users see none';
  assert not exists(select 1 from buykub.shop_order_discount(o)),'not their order';
end $$;

-- RLS: shops only see and write their own codes.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'carol',true);
select count(*)=0 as rls_hidden from buykub.promo_codes \gset
\if :rls_hidden
\else
  \echo 'FAIL: another shop sees promo codes'
  select 1/0;
\endif
do $$ declare denied boolean:=false; begin
  begin insert into buykub.promo_codes(shop_id,code,percent_off) values(current_setting('test.shop')::uuid,'HACK',90);
  exception when insufficient_privilege then denied:=true; end;
  assert denied,'cannot add to another shop';
end $$;
select set_config('request.jwt.claim.sub',:'seller',true);
select count(*)=7 as own_visible from buykub.promo_codes \gset
\if :own_visible
\else
  \echo 'FAIL: owner cannot see codes'
  select 1/0;
\endif
reset role;
\echo 'promo_codes OK'
rollback;
