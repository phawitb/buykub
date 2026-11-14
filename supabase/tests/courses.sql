-- Isolated database only; fixture identities and changes always roll back.
begin;
create or replace function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
do $$
declare
  seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); other_buyer uuid:=gen_random_uuid();
  shop uuid:=gen_random_uuid(); product uuid:=gen_random_uuid(); lesson uuid:=gen_random_uuid();
  ref uuid:=gen_random_uuid(); ref2 uuid:=gen_random_uuid(); receipt text:='cs_test_course';
  fulfilled record; expiry timestamptz; denied boolean:=false;
begin
  insert into auth.users(id,email,email_confirmed_at) values(seller,'seller@example.com',now()),(buyer,'verified@example.com',now()),(other_buyer,'other@example.com',now());
  insert into buykub.profiles(id) values(seller),(buyer),(other_buyer);
  insert into buykub.shops(id,owner_id,slug,name,published) values(shop,seller,'course-'||shop,'School',true);
  denied:=false;
  begin
    insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,course_access_days,published)
      values(product,shop,'course','Course',5000,'course',30,true);
  exception when others then denied:=SQLERRM='course_not_ready'; end;
  assert denied,'cannot insert an empty published course';
  insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,course_access_days,published)
    values(product,shop,'course','Course',5000,'course',30,false);
  denied:=false;
  begin update buykub.products set published=true where id=product;
  exception when others then denied:=SQLERRM='course_not_ready'; end;
  assert denied,'cannot publish a course without published lessons';
  perform set_config('request.jwt.claim.sub',seller::text,true);
  perform set_config('request.jwt.claims','{"app_metadata":{"provider":"google","providers":["google"]}}',true);
  perform buykub.save_course_lessons(product,jsonb_build_array(jsonb_build_object('id',lesson,'title','First lesson','position',0,'content_html','<p>Private</p>','published',true,'documents','[]'::jsonb)));
  update buykub.products set published=true where id=product;
  assert (buykub.course_access(product)->>'allowed')::boolean,'owner can preview';
  perform set_config('request.jwt.claim.sub','',true);
  begin perform buykub.begin_stripe_product_checkout(product,ref); exception when others then denied:=true; end;
  assert denied,'anonymous cannot initiate course purchase';
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  assert not (buykub.course_access(product)->>'allowed')::boolean,'unpaid buyer denied';
  perform buykub.begin_stripe_product_checkout(product,ref);
  perform buykub.attach_stripe_checkout_session(ref,receipt);
  -- Changing the public offer must not alter an already initiated purchase.
  update buykub.products set course_access_days=2 where id=product;
  select * into fulfilled from buykub.finalize_stripe_checkout(ref,receipt,'pi_course','buyer@example.com','Buyer');
  select course_expires_at into expiry from buykub.orders where id=fulfilled.order_id;
  assert expiry > now()+interval '29 days','duration captured at checkout';
  assert (select buyer_user_id=buyer and course_purchase from buykub.orders where id=fulfilled.order_id),'verified identity captured';
  assert (select buyer_email='verified@example.com' from buykub.orders where id=fulfilled.order_id),'course receipt email comes from verified buyer, never hosted checkout input';
  assert (buykub.course_access(product)->>'allowed')::boolean,'paid buyer allowed';
  assert (select count(*)=1 from buykub.my_courses()),'library lists purchased course';
  perform buykub.finalize_stripe_checkout(ref,receipt,'pi_course','different@example.com','Other');
  assert (select count(*)=1 from buykub.orders where stripe_checkout_session_id=receipt),'duplicate payment does not extend/create grant';
  assert (select course_expires_at=expiry from buykub.orders where id=fulfilled.order_id),'duplicate keeps expiry';
  perform set_config('request.jwt.claim.sub',other_buyer::text,true);
  assert not (buykub.course_access(product)->>'allowed')::boolean,'another account denied';
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  update buykub.orders set course_expires_at=now()-interval '1 second' where id=fulfilled.order_id;
  assert buykub.course_access(product)->>'reason'='expired','expired buyer denied';
  update buykub.orders set course_expires_at=expiry where id=fulfilled.order_id;
  perform buykub.sync_stripe_refund('pi_course',5000,1000,now());
  assert (buykub.course_access(product)->>'allowed')::boolean,'partial refund keeps course';
  perform buykub.sync_stripe_refund('pi_course',5000,5000,now()+interval '1 second');
  assert buykub.course_access(product)->>'reason'='refunded','full refund revokes course';
  update buykub.products set course_access_days=null where id=product;
  perform buykub.begin_stripe_product_checkout(product,ref2);
  perform buykub.attach_stripe_checkout_session(ref2,'pp_00000000-0000-4000-8000-000000000001');
  update auth.users set email=null where id=buyer;
  denied:=false;
  begin perform buykub.finalize_stripe_checkout(ref2,'pp_00000000-0000-4000-8000-000000000001','pi_course_lifetime','buyer@example.com','Buyer');
  exception when others then denied:=SQLERRM='course_buyer_email_required'; end;
  assert denied,'missing verified buyer email cannot use supplied checkout email';
  update auth.users set email='verified@example.com' where id=buyer;
  perform buykub.finalize_stripe_checkout(ref2,'pp_00000000-0000-4000-8000-000000000001','pi_course_lifetime','buyer@example.com','Buyer');
  assert (buykub.course_access(product)->>'allowed')::boolean,'repurchase restores access';
  assert buykub.course_access(product)->>'expires_at' is null,'lifetime grant has no expiry';
  assert not has_table_privilege('anon','buykub.course_lessons','SELECT'),'anonymous cannot query paid lesson content';
  assert not has_table_privilege('authenticated','buykub.orders','UPDATE'),'buyer cannot extend grant';
  assert not has_function_privilege('anon','buykub.save_course_lessons(uuid,jsonb)','EXECUTE'),'anonymous cannot write lessons';
end $$;
rollback;
