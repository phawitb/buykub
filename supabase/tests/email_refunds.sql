-- Run after bootstrap and migrations in an isolated database. Always rolls back.
begin;
do $$
declare
  owner uuid := gen_random_uuid(); shop uuid := gen_random_uuid(); product uuid := gen_random_uuid();
  ref uuid := gen_random_uuid(); ref2 uuid := gen_random_uuid(); service uuid := gen_random_uuid();
  delivery record; repeated record; claim jsonb; receipt record;
begin
  insert into auth.users(id,email,email_confirmed_at) values(owner,'buyer@example.com',now());
  perform set_config('request.jwt.claim.sub',owner::text,true);
  perform set_config('request.jwt.claims','{"app_metadata":{"provider":"google","providers":["google"]}}',true);
  insert into buykub.profiles(id) values(owner);
  insert into buykub.shops(id,owner_id,slug,name,published) values(shop,owner,'regression-'||shop,'Regression',true);
  insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published) values(product,shop,'file','Guide',10000,'file',true);
  perform buykub.begin_stripe_product_checkout(product,ref);
  perform buykub.attach_stripe_checkout_session(ref,'cs_test_regression');
  select * into delivery from buykub.finalize_stripe_checkout(ref,'cs_test_regression','pi_regression','buyer@example.com','Buyer');
  assert delivery.email_token is not null, 'file order must have delivery token';
  select * into repeated from buykub.finalize_stripe_checkout(ref,'cs_test_regression','pi_regression','buyer@example.com','Buyer');
  assert repeated.order_id = delivery.order_id and repeated.email_token = delivery.email_token, 'redelivery must preserve token and order';
  claim := buykub.claim_product_email(delivery.order_id,delivery.email_token,'{"to":["buyer@example.com"],"text":"original"}');
  assert claim->>'status'='claimed', 'first delivery must be claimed';
  assert (buykub.claim_product_email(delivery.order_id,delivery.email_token,'{}')->>'status')='busy', 'concurrent claim blocked';
  perform buykub.finish_product_email(delivery.order_id,(claim->>'lease')::uuid,null,'Provider offline');
  claim := buykub.claim_product_email(delivery.order_id,delivery.email_token,'{"text":"changed"}');
  assert claim->'payload'->>'text'='original', 'retry payload must be immutable';
  -- A provider-success/DB-failure retry must retain identical payload and key.
  update buykub.product_email_deliveries set lease_until=now()-interval '1 minute' where order_id=delivery.order_id;
  claim := buykub.claim_product_email(delivery.order_id,delivery.email_token,'{"text":"changed again"}');
  assert claim->'payload'->>'text'='original', 'expired lease must preserve original payload';
  perform buykub.finish_product_email(delivery.order_id,(claim->>'lease')::uuid,'email_1',null);
  assert (buykub.claim_product_email(delivery.order_id,delivery.email_token,'{}')->>'status')='sent', 'sent delivery not resent';

  perform buykub.sync_stripe_refund('pi_regression',10000,3000,'2026-11-12 10:00:00Z');
  assert (select status='paid' from buykub.orders where id=delivery.order_id), 'partial refund retains access';
  perform buykub.sync_stripe_refund('pi_regression',10000,10000,'2026-11-12 10:01:00Z');
  assert (select status='refunded' from buykub.orders where id=delivery.order_id), 'full refund revokes access';
  perform buykub.sync_stripe_refund('pi_regression',10000,3000,'2026-11-12 10:00:00Z');
  assert (select status='refunded' from buykub.orders where id=delivery.order_id), 'older snapshot cannot restore access';
  select * into receipt from buykub.get_stripe_checkout_success('cs_test_regression');
  assert receipt.status='refunded' and receipt.assigned_key is null, 'receipt reflects refund';
  select * into repeated from buykub.finalize_stripe_checkout(ref,'cs_test_regression','pi_regression','buyer@example.com','Buyer');
  assert repeated.email_token is null, 'refunded delivery must not be dispatched';

  perform buykub.sync_stripe_refund('pi_before',10000,10000,'2026-11-12 10:01:00Z');
  perform buykub.begin_stripe_product_checkout(product,ref2);
  perform buykub.attach_stripe_checkout_session(ref2,'cs_test_before');
  select * into delivery from buykub.finalize_stripe_checkout(ref2,'cs_test_before','pi_before','buyer@example.com','Buyer');
  assert (select status='refunded' from buykub.orders where id=delivery.order_id), 'refund arriving before fulfillment is retained';
  assert delivery.email_token is null, 'refund before fulfillment suppresses email';
  assert (buykub.claim_product_email(delivery.order_id,(select fulfilment_token from buykub.orders where id=delivery.order_id),'{}')->>'status')='revoked', 'refunded order cannot send';

  -- A third order simulates an ambiguous provider result beyond key retention.
  ref2 := gen_random_uuid();
  perform buykub.begin_stripe_product_checkout(product,ref2);
  perform buykub.attach_stripe_checkout_session(ref2,'cs_test_late');
  select * into delivery from buykub.finalize_stripe_checkout(ref2,'cs_test_late','pi_late','buyer@example.com','Buyer');
  claim := buykub.claim_product_email(delivery.order_id,delivery.email_token,'{}');
  update buykub.product_email_deliveries set first_attempt_at=now()-interval '25 hours',lease_until=now()-interval '1 minute' where order_id=delivery.order_id;
  assert (buykub.claim_product_email(delivery.order_id,delivery.email_token,'{}')->>'status')='review_required', 'expired provider key must not resend';
  assert not has_table_privilege('authenticated','buykub.orders','UPDATE'), 'sellers cannot edit paid status or recipient';
  assert not has_function_privilege('anon','buykub.claim_product_email(uuid,uuid,jsonb)','EXECUTE'), 'email claim must be private';
  assert not has_function_privilege('authenticated','buykub.sync_stripe_refund(text,integer,integer,timestamptz)','EXECUTE'), 'refund state must be private';
  insert into buykub.services(id,shop_id,name,price_cents,published) values(service,shop,'Consultation',10000,true);
  ref2 := gen_random_uuid();
  perform buykub.begin_stripe_service_checkout(service,ref2,'Buyer','buyer@example.com',now()+interval '1 day');
  perform buykub.attach_stripe_checkout_session(ref2,'cs_test_service');
  select * into delivery from buykub.finalize_stripe_checkout(ref2,'cs_test_service','pi_service','buyer@example.com','Buyer');
  perform buykub.sync_stripe_refund('pi_service',10000,10000,'2026-11-12 10:01:00Z');
  -- A later bank failure needs manual reconciliation, never a false success UI.
  perform buykub.sync_stripe_refund('pi_service',10000,0,'2026-11-12 10:02:00Z');
  select * into receipt from buykub.get_stripe_checkout_success('cs_test_service');
  assert receipt.status='refunded' and receipt.booking_status='cancelled', 'later failed refund must not silently reinstate a service';
  select * into repeated from buykub.finalize_stripe_checkout(ref2,'cs_test_service','pi_service','buyer@example.com','Buyer');
  assert repeated.booking_id is null, 'refunded service must not dispatch calendar again';
  assert has_function_privilege('service_role','buykub.sync_stripe_refund(text,integer,integer,timestamptz)','EXECUTE'), 'webhook role can sync';
end $$;
rollback;
