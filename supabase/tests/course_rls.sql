-- Run with psql against an isolated database after the BUYKUB migrations.
-- Unlike the entitlement unit tests, these queries run as actual API roles.
-- Fixtures and all session settings roll back; no storage service is needed.
\set ON_ERROR_STOP on
begin;
select gen_random_uuid() seller, gen_random_uuid() buyer, gen_random_uuid() outsider,
  gen_random_uuid() shop, gen_random_uuid() product, gen_random_uuid() lesson,
  gen_random_uuid() draft, gen_random_uuid() ord, gen_random_uuid() doc \gset
insert into auth.users(id) values(:'seller'),(:'buyer'),(:'outsider');
insert into buykub.profiles(id) values(:'seller'),(:'buyer'),(:'outsider');
insert into buykub.shops(id,owner_id,slug,name,published)
  values(:'shop',:'seller','rls-'||:'shop','RLS school',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,course_access_days,published)
  values(:'product',:'shop','course','RLS course',5000,'course',30,false);
select set_config('request.jwt.claim.sub',:'seller',true);
select buykub.save_course_lessons(:'product',jsonb_build_array(
  jsonb_build_object('id',:'lesson','title','Paid','content_html','<p>Secret</p>','published',true,
    'documents',jsonb_build_array(jsonb_build_object('id',:'doc','name','Notes','path',:'seller'||'/secret.pdf'))),
  jsonb_build_object('id',:'draft','title','Draft','published',false)));
update buykub.products set published=true where id=:'product';
select set_config('test.course_product',:'product',true),
  set_config('test.course_ownerpath',:'seller'||'/secret.pdf',true);

set local role authenticated;
do $$begin
  assert (select count(*)=2 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'owner sees drafts and published lessons';
end$$;
reset role;

-- A seller must not be able to persist a path whose URL normalization escapes
-- their own prefix before the service-role Storage signer receives it.
set local role authenticated;
do $$declare denied boolean; bad_path text; begin
  foreach bad_path in array array[
    replace(current_setting('test.course_ownerpath'),'/secret.pdf','/%2e%2e/other/secret.pdf'),
    replace(current_setting('test.course_ownerpath'),'/secret.pdf','/%252e%252e/other/secret.pdf'),
    current_setting('test.course_ownerpath')||'?other',
    current_setting('test.course_ownerpath')||'#other',
    replace(current_setting('test.course_ownerpath'),'/secret.pdf','//secret.pdf'),
    replace(current_setting('test.course_ownerpath'),'/secret.pdf','/./secret.pdf'),
    current_setting('test.course_ownerpath')||'/'
  ] loop
    denied:=false;
    begin
      perform buykub.save_course_lessons(current_setting('test.course_product')::uuid,
        jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','Unsafe attachment','published',true,
          'documents',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Unsafe','path',bad_path)))));
    exception when others then denied:=sqlerrm='document_access_denied'; end;
    assert denied,'seller path normalization attack rejected: '||bad_path;
    assert not buykub.can_read_course_document(bad_path),'unsafe path cannot authorize signing';
  end loop;
end$$;
reset role;

-- Also fail closed for malformed data inserted outside the authoring RPC.
update buykub.course_lessons set documents=documents||jsonb_build_array(jsonb_build_object(
  'id',gen_random_uuid(),'name','Legacy unsafe attachment',
  'path',replace(current_setting('test.course_ownerpath'),'/secret.pdf','/%2e%2e/other/secret.pdf')))
  where id=:'lesson';
set local role authenticated;
do $$begin
  assert not buykub.can_read_course_document(
    replace(current_setting('test.course_ownerpath'),'/secret.pdf','/%2e%2e/other/secret.pdf')),
    'even an attached encoded path cannot authorize privileged signing';
end$$;
reset role;

select set_config('request.jwt.claim.sub',:'buyer',true);
set local role authenticated;
do $$begin
  assert (select count(*)=0 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'unpaid buyer sees no lessons';
  assert not buykub.can_read_course_document(current_setting('test.course_ownerpath')),
    'unpaid buyer cannot access an attachment';
end$$;
reset role;

insert into buykub.orders(id,shop_id,product_id,buyer_email,price_cents,status,payment_method,
  paid_at,buyer_user_id,course_purchase,course_expires_at)
  values(:'ord',:'shop',:'product','rls@example.invalid',5000,'paid','stripe',
    now(),:'buyer',true,now()+interval '30 days');
set local role authenticated;
do $$begin
  assert (select count(*)=1 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'paid buyer sees only published lessons';
  assert buykub.can_read_course_document(current_setting('test.course_ownerpath')),
    'paid buyer can access the exact attachment';
  assert not buykub.can_read_course_document('99999999-9999-4999-8999-999999999999/secret.pdf'),
    'paid buyer cannot access an unrelated storage path';
end$$;
reset role;

select set_config('request.jwt.claim.sub',:'outsider',true);
set local role authenticated;
do $$begin
  assert (select count(*)=0 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'another account sees no lessons';
  assert not buykub.can_read_course_document(current_setting('test.course_ownerpath')),
    'another account cannot access the attachment';
end$$;
reset role;

select set_config('request.jwt.claim.sub',:'buyer',true);
update buykub.orders set course_expires_at=now()-interval '1 second' where id=:'ord';
set local role authenticated;
do $$begin
  assert (select count(*)=0 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'expired buyer sees no lessons';
  assert not buykub.can_read_course_document(current_setting('test.course_ownerpath')),
    'expired buyer cannot access the attachment';
end$$;
reset role;

update buykub.orders set course_expires_at=now()+interval '30 days',status='refunded' where id=:'ord';
set local role authenticated;
do $$begin
  assert (select count(*)=0 from buykub.course_lessons where product_id=current_setting('test.course_product')::uuid),
    'refunded buyer sees no lessons';
  assert not buykub.can_read_course_document(current_setting('test.course_ownerpath')),
    'refunded buyer cannot access the attachment';
end$$;
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$declare denied boolean:=false; begin
  begin perform 1 from buykub.course_lessons;
  exception when insufficient_privilege then denied:=true; end;
  assert denied,'anonymous cannot SELECT course_lessons';
end$$;
reset role;

-- Buyers must go through the authorized server download route rather than
-- mint their own Storage signed URLs with an arbitrary expiry duration.
do $$begin
  assert not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='paid course documents'), 'buyer Storage signing policy must be absent';
end$$;
rollback;
