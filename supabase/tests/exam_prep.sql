-- Run with psql against an isolated database after the BUYKUB migrations.
-- Exam-prep readiness, and progress that only the entitled learner can read or write.
-- Fixtures and all session settings roll back.
\set ON_ERROR_STOP on
begin;
select gen_random_uuid() seller, gen_random_uuid() buyer, gen_random_uuid() outsider,
  gen_random_uuid() shop, gen_random_uuid() product, gen_random_uuid() ord \gset
insert into auth.users(id) values(:'seller'),(:'buyer'),(:'outsider');
insert into buykub.profiles(id) values(:'seller'),(:'buyer'),(:'outsider');
insert into buykub.shops(id,owner_id,slug,name,published)
  values(:'shop',:'seller','exam-'||:'shop','Exam school',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,course_format,course_access_days,published)
  values(:'product',:'shop','exam','Exam course',5000,'course','exam_prep',30,false);
select set_config('test.product',:'product',true),set_config('test.buyer',:'buyer',true),
  set_config('test.outsider',:'outsider',true);

do $$declare denied boolean:=false; begin
  begin update buykub.products set published=true where id=current_setting('test.product')::uuid;
  exception when others then denied:=sqlerrm='course_not_ready'; end;
  assert denied,'an exam-prep course without a pack cannot be published';
  denied:=false;
  begin update buykub.products set exam_summary='{"format":"other"}' where id=current_setting('test.product')::uuid;
  exception when check_violation then denied:=true; end;
  assert denied,'summary must be an exam-prep summary';
  denied:=false;
  begin update buykub.products set course_format='exam_prep',delivery_type='file' where id=current_setting('test.product')::uuid;
  exception when check_violation then denied:=true; end;
  assert denied,'only courses can use the exam-prep format';
end$$;
update buykub.products set exam_summary='{"format":"exam-prep","days":30,"questions":1200}',published=true where id=:'product';

-- Not purchased: no reads, no writes.
select set_config('request.jwt.claim.sub',:'outsider',true);
set local role authenticated;
do $$declare denied boolean:=false; begin
  begin perform buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{}}',null);
  exception when others then denied:=sqlerrm='course_access_denied'; end;
  assert denied,'outsider cannot save progress';
  denied:=false;
  begin insert into buykub.course_progress(user_id,product_id,state) values(current_setting('test.outsider')::uuid,current_setting('test.product')::uuid,'{}');
  exception when insufficient_privilege then denied:=true; end;
  assert denied,'learners never write the table directly';
end$$;
reset role;

insert into buykub.orders(id,shop_id,product_id,buyer_email,price_cents,status,payment_method,
  paid_at,buyer_user_id,course_purchase,course_expires_at)
  values(:'ord',:'shop',:'product','exam@example.invalid',5000,'paid','stripe',
    now(),:'buyer',true,now()+interval '30 days');

select set_config('request.jwt.claim.sub',:'buyer',true);
set local role authenticated;
do $$declare r jsonb; first timestamptz; denied boolean:=false; begin
  r:=buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{"M001":{"n":1,"c":1}}}',null);
  assert not (r->>'conflict')::boolean,'first save succeeds';
  first:=(r->>'updated_at')::timestamptz;
  r:=buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{}}',null);
  assert (r->>'conflict')::boolean and r->'state'->'att' ? 'M001','a save without the current version returns the stored copy';
  r:=buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{"M002":{"n":1,"c":0}}}',first);
  assert not (r->>'conflict')::boolean and (r->>'updated_at')::timestamptz>first,'save with the current version succeeds';
  r:=buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{}}',first);
  assert (r->>'conflict')::boolean,'a stale version cannot overwrite another device';
  assert (select state->'att' ? 'M002' from buykub.course_progress where product_id=current_setting('test.product')::uuid),'buyer reads own progress';
  begin perform buykub.save_course_progress(current_setting('test.product')::uuid,jsonb_build_object('x',repeat('a',600000)),(r->>'updated_at')::timestamptz);
  exception when others then denied:=sqlerrm='invalid_progress'; end;
  assert denied,'progress over 512 KB is rejected';
  denied:=false;
  begin perform buykub.save_course_progress(current_setting('test.product')::uuid,'[]',(r->>'updated_at')::timestamptz);
  exception when others then denied:=sqlerrm='invalid_progress'; end;
  assert denied,'progress must be an object';
end$$;
reset role;

select set_config('request.jwt.claim.sub',:'outsider',true);
set local role authenticated;
do $$begin
  assert (select count(*)=0 from buykub.course_progress),'another user cannot read the buyer''s progress';
end$$;
reset role;

update buykub.orders set course_expires_at=now()-interval '1 second' where id=:'ord';
select set_config('request.jwt.claim.sub',:'buyer',true);
set local role authenticated;
do $$declare denied boolean:=false; begin
  assert (select count(*)=0 from buykub.course_progress),'expired access hides progress';
  begin perform buykub.save_course_progress(current_setting('test.product')::uuid,'{"att":{}}',null);
  exception when others then denied:=sqlerrm='course_access_denied'; end;
  assert denied,'expired access cannot write progress';
end$$;
reset role;

do $$begin
  assert not has_function_privilege('anon','buykub.save_course_progress(uuid,jsonb,timestamptz)','execute'),'anon cannot save progress';
  assert not has_function_privilege('authenticated','buykub.course_ready(uuid,text,jsonb)','execute'),'readiness is internal';
end$$;
rollback;
