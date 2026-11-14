-- Isolated fixture only; no production data is accessed or retained.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select gen_random_uuid() administrator, gen_random_uuid() seller, gen_random_uuid() shop, gen_random_uuid() product \gset
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
(:'administrator','phawit.boo@gmail.com',now(),'{"provider":"google"}'),
(:'seller','admin-test@example.com',now(),'{"provider":"google"}');
insert into buykub.profiles(id) values(:'administrator'),(:'seller');
insert into buykub.shops(id,owner_id,name,slug) values(:'shop',:'seller','Admin test','admin-test-'||:'shop');
insert into buykub.products(id,shop_id,name,slug,price_cents,published) values(:'product',:'shop','Product','product-'||:'product',10000,true);
insert into buykub.stripe_checkout_contexts(checkout_reference,kind,shop_id,product_id,amount_cents,stripe_session_id)
values(gen_random_uuid(),'product',:'shop',:'product',10000,'cs_admin_test');
select set_config('test.admin.id',:'administrator',true),set_config('test.seller.id',:'seller',true),set_config('test.shop.id',:'shop',true),set_config('test.product.id',:'product',true);
do $$ declare t text; denied boolean;
begin
  foreach t in array array['admin_user_controls','admin_content_controls','admin_audit_log','platform_site_settings'] loop
    assert not has_table_privilege('anon','buykub.'||t,'select');
    assert not has_table_privilege('authenticated','buykub.'||t,'select');
    assert not has_table_privilege('authenticated','buykub.'||t,'insert');
    assert not has_table_privilege('authenticated','buykub.'||t,'update');
    assert (select relrowsecurity and relforcerowsecurity from pg_class where oid=('buykub.'||t)::regclass);
  end loop;
  assert not has_function_privilege('authenticated','buykub.admin_apply_action(uuid,text,jsonb)','execute');
  assert not has_function_privilege('anon','buykub.assert_platform_admin(uuid)','execute');
  denied := false;
  begin perform buykub.admin_apply_action(current_setting('test.seller.id')::uuid,'save-user',jsonb_build_object('userId',current_setting('test.seller.id'),'note','secret','payoutHold',true));
  exception when insufficient_privilege then denied:=true; end;
  assert denied, 'non admin actor denied even through privileged RPC';
end $$;
select buykub.admin_apply_action(:'administrator','save-user',jsonb_build_object('userId',:'seller','note','private operator note','payoutHold',true));
select buykub.admin_apply_action(:'administrator','set-product',jsonb_build_object('id',:'product','published',false));
select set_config('request.jwt.claim.sub',:'seller',true);
set local role authenticated;
do $$ declare denied boolean:=false;
begin
  begin update buykub.products set published=true where id=current_setting('test.product.id')::uuid;
  exception when insufficient_privilege then denied:=true; end;
  assert denied, 'owner cannot republish hidden product';
end $$;
reset role;
do $$ declare denied boolean;
begin
  denied:=false;
  begin insert into buykub.stripe_checkout_contexts(checkout_reference,kind,shop_id,product_id,amount_cents) values(gen_random_uuid(),'product',current_setting('test.shop.id')::uuid,current_setting('test.product.id')::uuid,10000);
  exception when insufficient_privilege then denied:=true; end;
  assert denied, 'new checkout blocked';
  assert (select payout_hold from buykub.admin_user_controls where user_id=current_setting('test.seller.id')::uuid);
  assert not exists(select 1 from buykub.admin_audit_log where metadata::text like '%private operator note%'), 'notes never audited';
end $$;
select set_config('request.jwt.claim.role','service_role',true);
select * from buykub.finalize_stripe_checkout((select checkout_reference from buykub.stripe_checkout_contexts where stripe_session_id='cs_admin_test'),'cs_admin_test','pi_admin_test','buyer@example.com','Buyer');
select set_config('request.jwt.claim.role','',true);
select buykub.admin_apply_action(:'administrator','set-shop',jsonb_build_object('id',:'shop','published',false));
set local role authenticated;
do $$ declare denied boolean:=false;
begin
  begin update buykub.shops set published=true where id=current_setting('test.shop.id')::uuid;
  exception when insufficient_privilege then denied:=true; end;
  assert denied, 'owner cannot republish suspended shop';
end $$;
reset role;
select buykub.admin_apply_action(:'administrator','set-shop',jsonb_build_object('id',:'shop','published',true));
select buykub.admin_apply_action(:'administrator','set-product',jsonb_build_object('id',:'product','published',true));
do $$ begin
  assert (select published from buykub.shops where id=current_setting('test.shop.id')::uuid);
  assert (select published from buykub.products where id=current_setting('test.product.id')::uuid);
  assert (select status='paid' from buykub.orders where stripe_checkout_session_id='cs_admin_test'), 'existing paid checkout fulfilled after takedown';
end $$;
rollback;
