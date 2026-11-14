-- Isolated database only. Fixtures and session settings always roll back.
begin;
do $$
declare
  seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); shop uuid:=gen_random_uuid();
  product uuid; ref uuid; key_id uuid; kind text; amount integer; scenario text;
  denied boolean; delivered record;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (seller,'seller@example.com',now()),(buyer,'buyer@example.com',now());
  insert into buykub.profiles(id) values(seller),(buyer);
  insert into buykub.shops(id,owner_id,slug,name,published) values(shop,seller,'google-'||shop,'Google checkout',true);
  foreach kind in array array['file','key','course'] loop
    foreach amount in array array[0,10000] loop
      product:=gen_random_uuid(); key_id:=gen_random_uuid();
      insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published)
        values(product,shop,product::text,'Test product',amount,kind,false);
      if kind='course' then
        insert into buykub.course_lessons(product_id,title,position,published) values(product,'Lesson',0,true);
      elsif kind='key' then
        insert into buykub.product_keys(id,product_id,key_value,key_fingerprint,status)
          values(key_id,product,'test-key-'||key_id,key_id::text,'available');
      end if;
      update buykub.products set published=true where id=product;
      foreach scenario in array array['guest','non_google','unconfirmed','missing_email','missing_user'] loop
        ref:=gen_random_uuid(); denied:=false;
        update auth.users set email='buyer@example.com',email_confirmed_at=now() where id=buyer;
        perform set_config('request.jwt.claim.sub',case when scenario='guest' then '' when scenario='missing_user' then gen_random_uuid()::text else buyer::text end,true);
        perform set_config('request.jwt.claims',case when scenario='non_google' then '{"app_metadata":{"provider":"email","providers":["email"]}}' else '{"app_metadata":{"provider":"google","providers":["google"]}}' end,true);
        if scenario='unconfirmed' then update auth.users set email_confirmed_at=null where id=buyer; end if;
        if scenario='missing_email' then update auth.users set email=null where id=buyer; end if;
        begin
          perform buykub.begin_stripe_product_checkout(product,ref);
        exception when others then
          denied:=SQLERRM='google_login_required';
        end;
        assert denied,format('%s cannot start %s checkout at %s',scenario,kind,amount);
        assert not exists(select 1 from buykub.stripe_checkout_contexts where checkout_reference=ref),'rejected checkout must not create context';
        if kind='key' then
          assert (select status='available' from buykub.product_keys where id=key_id),'rejected checkout must not reserve stock';
        end if;
      end loop;
      update auth.users set email='buyer@example.com',email_confirmed_at=now() where id=buyer;
      perform set_config('request.jwt.claim.sub',buyer::text,true);
      perform set_config('request.jwt.claims','{"app_metadata":{"provider":"google","providers":["google"]}}',true);
      ref:=gen_random_uuid();
      perform buykub.begin_stripe_product_checkout(product,ref);
      assert (select amount_cents=amount and status='created' from buykub.stripe_checkout_contexts where checkout_reference=ref),'verified Google buyer can start paid and free checkout';
      if kind='course' then
        assert (select buyer_user_id=buyer and course_purchase from buykub.stripe_checkout_contexts where checkout_reference=ref),'course identity binding remains unchanged';
      else
        assert (select buyer_user_id=buyer and not course_purchase from buykub.stripe_checkout_contexts where checkout_reference=ref),'file/key checkout binds the verified buyer';
      end if;
      if kind='key' then
        assert (select status='reserved' and stripe_checkout_reference=ref from buykub.product_keys where id=key_id),'verified Google buyer reserves available key';
      end if;
      perform buykub.attach_stripe_checkout_session(ref,'cs_google_'||ref);
      select * into delivered from buykub.finalize_stripe_checkout(ref,'cs_google_'||ref,'pi_google_'||ref,'forged@example.com','Forged buyer');
      assert (select buyer_email='buyer@example.com' and buyer_user_id=buyer from buykub.orders where id=delivered.order_id),'fulfillment ignores forged Stripe email for every new checkout';
    end loop;
  end loop;
  -- A pre-migration guest file checkout still fulfills to its original email.
  product:=gen_random_uuid(); ref:=gen_random_uuid();
  insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published)
    values(product,shop,product::text,'Legacy file',0,'file',true);
  insert into buykub.stripe_checkout_contexts(checkout_reference,kind,shop_id,product_id,amount_cents)
    values(ref,'product',shop,product,0);
  perform buykub.attach_stripe_checkout_session(ref,'cs_legacy_'||ref);
  select * into delivered from buykub.finalize_stripe_checkout(ref,'cs_legacy_'||ref,null,'legacy@example.com','Legacy buyer');
  assert (select buyer_email='legacy@example.com' and buyer_user_id is null from buykub.orders where id=delivered.order_id),'existing guest context retains its original fulfillment authorization';
  assert not has_function_privilege('anon','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE'),'anonymous role cannot invoke reservation RPC';
  assert has_function_privilege('authenticated','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE'),'authenticated buyers may invoke guarded RPC';
  assert has_function_privilege('service_role','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE'),'service role retains guarded RPC';
end $$;
rollback;
