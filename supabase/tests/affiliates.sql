-- Isolated database only. All fixture rows roll back.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select gen_random_uuid() seller, gen_random_uuid() alice, gen_random_uuid() bob, gen_random_uuid() carol,
  gen_random_uuid() shop, gen_random_uuid() product \gset
insert into auth.users(id,email,email_confirmed_at) values
  (:'seller','seller@example.com',now()),(:'alice','alice@example.com',now()),(:'bob','bob@example.com',now()),(:'carol','carol@example.com',now());
insert into buykub.profiles(id) values(:'seller'),(:'alice'),(:'bob'),(:'carol');
insert into buykub.shops(id,owner_id,slug,name,published) values(:'shop',:'seller','aff-'||:'shop','Referral shop',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published) values(:'product',:'shop','guide','Guide',10000,'file',true);
-- Stand-in admin check: the real one is bound to the platform owner's account.
create or replace function buykub.assert_platform_admin(p_actor uuid) returns void language plpgsql as $$
begin if p_actor is null or p_actor<>current_setting('test.seller')::uuid then raise exception 'platform_admin_required'; end if; end $$;
select set_config('test.seller',:'seller',false),set_config('test.alice',:'alice',false),set_config('test.bob',:'bob',false),
  set_config('test.carol',:'carol',false),set_config('test.shop',:'shop',false),set_config('test.product',:'product',false);

-- Buys the product as p_user through PromptPay, optionally via a referral code.
create function pg_temp.buy(p_user uuid, p_code text, p_intent text) returns uuid language plpgsql as $$
declare ref uuid:=gen_random_uuid(); r record;
begin
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform buykub.begin_stripe_product_checkout(current_setting('test.product')::uuid,ref);
  perform buykub.attach_checkout_referral(ref,p_code);
  perform buykub.prepare_promptpay_checkout(ref,(select email from auth.users where id=p_user));
  perform buykub.attach_promptpay_intent(ref,p_intent);
  select * into r from buykub.finalize_promptpay_checkout(ref,p_intent,10000,'thb');
  return r.order_id;
end $$;

do $$
declare
  seller uuid:=current_setting('test.seller'); alice uuid:=current_setting('test.alice'); bob uuid:=current_setting('test.bob');
  carol uuid:=current_setting('test.carol'); shop uuid:=current_setting('test.shop'); product uuid:=current_setting('test.product');
  code text; code2 text; first_order uuid; bob_order uuid; carol_order uuid; b uuid; ab uuid; denied boolean;
begin
  first_order:=pg_temp.buy(alice,null,'pi_alice');
  -- Referrals are off until the shop sets a rate.
  perform set_config('request.jwt.claim.sub',alice::text,true);
  denied:=false; begin perform buykub.get_affiliate_link(product); exception when others then denied:=sqlerrm='affiliate_disabled'; end;
  assert denied,'disabled product gives no link';
  update buykub.products set affiliate_rate_bp=1000 where id=product;
  code:=buykub.get_affiliate_link(product);
  code2:=buykub.get_affiliate_link(product);
  assert code ~ '^[a-z0-9]{10}$' and code=code2,'one stable link per buyer and product';
  assert (select shop_slug='aff-'||shop and product_slug='guide' from buykub.resolve_affiliate_code(upper(code))),'link resolves to the product page';
  -- Only earlier buyers.
  perform set_config('request.jwt.claim.sub',bob::text,true);
  denied:=false; begin perform buykub.get_affiliate_link(product); exception when others then denied:=sqlerrm='affiliate_not_eligible'; end;
  assert denied,'a non-buyer cannot get a link';

  -- Bob buys through Alice's link at the normal price.
  bob_order:=pg_temp.buy(bob,code,'pi_bob');
  assert (select price_cents=10000 from buykub.orders where id=bob_order),'no buyer discount';
  assert (select affiliate_user_id=alice and status='pending' and amount_cents=1000 and rate_bp=1000 from buykub.affiliate_commissions where order_id=bob_order),'commission recorded';
  -- A rate change later does not touch it.
  update buykub.products set affiliate_rate_bp=2000 where id=product;
  assert (select rate_bp=1000 from buykub.affiliate_commissions where order_id=bob_order),'rate snapshot at checkout';
  update buykub.products set affiliate_rate_bp=1000 where id=product;

  -- Unknown codes, own links and refunded referrers earn nothing and never block
  -- the purchase. Each test purchase is refunded afterwards (and its commission
  -- voided) so it does not reach the payout below.
  carol_order:=pg_temp.buy(carol,'nonexistent','pi_carol_1');
  assert carol_order is not null and not exists(select 1 from buykub.affiliate_commissions where order_id=carol_order),'bad code ignored';
  perform buykub.sync_stripe_refund('pi_carol_1',10000,10000,now());
  perform set_config('request.jwt.claim.sub',bob::text,true);
  carol_order:=pg_temp.buy(carol,buykub.get_affiliate_link(product),'pi_carol_2');
  assert exists(select 1 from buykub.affiliate_commissions where order_id=carol_order and affiliate_user_id=bob),'any earlier buyer can refer';
  -- Carol now owns a paid order and may refer, but not herself.
  perform set_config('request.jwt.claim.sub',carol::text,true);
  code2:=buykub.get_affiliate_link(product);
  perform buykub.sync_stripe_refund('pi_carol_2',10000,10000,now());
  carol_order:=pg_temp.buy(carol,code2,'pi_carol_3');
  assert not exists(select 1 from buykub.affiliate_commissions where order_id=carol_order),'own link earns nothing';
  perform buykub.sync_stripe_refund('pi_carol_3',10000,10000,now());
  -- Every purchase of Carol's is refunded now, so her link no longer pays.
  carol_order:=pg_temp.buy(bob,code2,'pi_bob_2');
  assert not exists(select 1 from buykub.affiliate_commissions where order_id=carol_order),'refunded buyer cannot refer';
  perform buykub.sync_stripe_refund('pi_bob_2',10000,10000,now());

  -- Shop payout withholds the commission.
  update buykub.orders set paid_at=now()-interval '10 days' where id in (first_order,bob_order);
  update buykub.orders set payment_method='stripe' where id in (first_order,bob_order);
  insert into buykub.seller_payout_profiles(shop_id,payout_method,promptpay_id,full_name_th,contact_phone,national_id,address_line,subdistrict,district,province,postal_code)
  values(shop,'promptpay','0812345678','สมชาย ใจดี','0812345678','1101700207030','1','ก','ก','ก','10110')
  on conflict(shop_id) do update set payout_method=excluded.payout_method,promptpay_id=excluded.promptpay_id,bank_details=null,full_name_th=excluded.full_name_th,
    contact_phone=excluded.contact_phone,national_id=excluded.national_id,address_line=excluded.address_line,subdistrict=excluded.subdistrict,district=excluded.district,province=excluded.province,postal_code=excluded.postal_code;
  insert into buykub.seller_payout_observations(order_id,payment_intent_id,charge_id,balance_transaction_id,eligible,reason,gross_cents,refunded_cents,net_cents,checked_at)
  values(first_order,'pi_alice','ch_alice','txn_alice',true,'eligible',10000,0,9500,now()),(bob_order,'pi_bob','ch_bob','txn_bob',true,'eligible',10000,0,9500,now());
  b:=buykub.prepare_seller_payout_batch(null,'aff:1',shop);
  assert (select amount_cents=9500+8500 from buykub.seller_payout_batches where id=b),'shop amount is net of commission';
  assert (select affiliate_cents=1000 from buykub.seller_payout_allocations where batch_id=b and order_id=bob_order),'withholding recorded';
  assert (select status='pending' from buykub.affiliate_commissions where order_id=bob_order),'not payable before the shop is paid';
  -- A cancelled shop payout releases the order without changing the commission.
  perform buykub.cancel_seller_payout_batch(null,b);
  b:=buykub.prepare_seller_payout_batch(null,'aff:2',shop);
  perform buykub.attach_seller_payout_slip(seller,b,b::text||'/20000000-0000-0000-0000-000000000001.png','image/png',100);
  perform buykub.complete_manual_seller_payout(null,b,'bank-reference-aff',now());
  assert (select status='payable' and amount_cents=1000 and seller_batch_id=b from buykub.affiliate_commissions where order_id=bob_order),'payable after the shop transfer';

  -- Affiliate payout: profile required, then one manual transfer.
  denied:=false; begin perform buykub.prepare_affiliate_payout_batch(null,'m:1',alice); exception when check_violation then denied:=sqlerrm='payout_profile_incomplete_or_name_mismatch'; end;
  assert denied,'payout profile required';
  insert into buykub.affiliate_payout_profiles(user_id,payout_method,promptpay_id,full_name_th,contact_phone,national_id,address_line,subdistrict,district,province,postal_code)
  values(alice,'promptpay','0898765432','สมหญิง ใจดี','0898765432','1101700207030','1','ก','ก','ก','10110');
  ab:=buykub.prepare_affiliate_payout_batch(null,'m:1',alice);
  assert ab=buykub.prepare_affiliate_payout_batch(null,'m:1',alice),'retry returns the same batch';
  assert (select amount_cents=1000 and not recipient_snapshot ?| array['national_id','nationalId','address_line'] from buykub.affiliate_payout_batches where id=ab),'amount and no identity in instructions';
  assert buykub.prepare_affiliate_payout_batch(null,'m:2',alice) is null,'no double allocation';
  denied:=false; begin perform buykub.complete_manual_affiliate_payout(null,ab,'bank-reference-a1',now()); exception when check_violation then denied:=sqlerrm='payout_slip_required'; end;
  assert denied,'slip required';
  perform buykub.cancel_affiliate_payout_batch(null,ab);
  ab:=buykub.prepare_affiliate_payout_batch(null,'m:3',alice);
  assert ab is not null,'cancel releases commissions';
  perform buykub.attach_affiliate_payout_slip(seller,ab,'affiliate/'||ab::text||'/20000000-0000-0000-0000-000000000002.png','image/png',100);
  denied:=false; begin perform buykub.cancel_affiliate_payout_batch(null,ab); exception when check_violation then denied:=true; end;
  assert denied,'cannot cancel once a slip is attached';
  perform buykub.complete_manual_affiliate_payout(null,ab,'bank-reference-a1',now());
  perform buykub.complete_manual_affiliate_payout(null,ab,'bank-reference-a1',now());
  assert (select status='paid' from buykub.affiliate_commissions where order_id=bob_order),'paid';
  assert (select status='completed' and not completion_review_required from buykub.affiliate_payout_batches where id=ab),'clean completion';
  assert buykub.prepare_affiliate_payout_batch(null,'m:4',alice) is null,'paid once';
  -- A refund after the transfer cannot un-pay it.
  perform buykub.sync_stripe_refund('pi_bob',10000,10000,now());
  assert (select status='paid' from buykub.affiliate_commissions where order_id=bob_order),'paid stays paid';

  -- A full refund voids a pending commission and the shop then keeps nothing for it.
  perform set_config('request.jwt.claim.sub',alice::text,true);
  bob_order:=pg_temp.buy(carol,buykub.get_affiliate_link(product),'pi_carol_4');
  assert (select status='pending' from buykub.affiliate_commissions where order_id=bob_order),'second commission';
  perform buykub.sync_stripe_refund('pi_carol_4',10000,10000,now());
  assert (select status='void' and voided_at is not null from buykub.affiliate_commissions where order_id=bob_order),'refund voids';
end $$;

-- Privileges.
do $$ begin
  assert not has_table_privilege('anon','buykub.affiliate_commissions','select'),'anon cannot read commissions';
  assert not has_column_privilege('authenticated','buykub.affiliate_commissions','affiliate_user_id','select'),'shops cannot see who referred';
  assert not has_table_privilege('authenticated','buykub.affiliate_payout_batches','select'),'batches are private';
  assert not has_function_privilege('authenticated','buykub.prepare_affiliate_payout_batch(uuid,text,uuid)','execute'),'payout is admin only';
  assert not has_function_privilege('anon','buykub.get_affiliate_link(uuid)','execute'),'anon gets no link';
  assert has_function_privilege('anon','buykub.resolve_affiliate_code(text)','execute'),'links resolve for visitors';
  assert not has_function_privilege('authenticated','buykub.affiliate_withholding(uuid,bigint,bigint)','execute'),'internal helper hidden';
end $$;
select set_config('request.jwt.claim.sub',:'seller',true);
set local role authenticated;
do $$ begin
  assert (select count(*)=3 from buykub.affiliate_commissions),'shop sees commissions on its orders';
  assert (select count(*)=0 from buykub.affiliate_links),'shop sees no buyer links';
  assert (select count(*)=0 from buykub.affiliate_payout_profiles),'shop sees no affiliate profile';
end $$;
reset role;
select set_config('request.jwt.claim.sub',:'alice',true);
set local role authenticated;
do $$ begin
  assert (select count(*)=1 from buykub.affiliate_links),'alice sees only her link';
  assert (select count(*)=1 from buykub.affiliate_payout_profiles),'alice sees her profile';
  assert (select count(*)=2 and bool_or(status='paid') and bool_or(status='void') from buykub.my_affiliate_commissions()),'alice sees her commissions';
  assert (select count(*)=0 from buykub.affiliate_commissions),'commission rows are read through the function only';
end $$;
reset role;
select set_config('request.jwt.claim.sub',:'bob',true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
  assert (select count(*)=1 and bool_and(status='void') from buykub.my_affiliate_commissions()),'bob sees only his own commission';
  begin update buykub.affiliate_payout_profiles set promptpay_id='0811111111'; exception when others then denied:=true; end;
  assert (select count(*)=0 from buykub.affiliate_payout_profiles),'bob cannot see alice profile';
end $$;
reset role;
rollback;
