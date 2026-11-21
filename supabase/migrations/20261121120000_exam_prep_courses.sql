-- Exam-prep courses: a course whose content is one private study pack instead of lessons.
-- The pack lives at product-files/<owner>/exam-prep/<product>/pack.json; the path is derived,
-- never stored, so a seller cannot point their product at someone else's file.
begin;
alter table buykub.products
  add column course_format text not null default 'lessons' check(course_format in ('lessons','exam_prep')),
  -- Public counts for the sales page (subjects, questions, days). Never lesson text or answers.
  add column exam_summary jsonb check(exam_summary is null or (jsonb_typeof(exam_summary)='object'
    and exam_summary->>'format'='exam-prep' and octet_length(exam_summary::text)<=32768));
alter table buykub.products add constraint products_exam_prep_is_course
  check(course_format='lessons' or delivery_type='course');

create function buykub.course_ready(p_product_id uuid,p_format text,p_summary jsonb)
returns boolean language sql stable security definer set search_path=buykub,pg_temp as $$
  select case when p_format='exam_prep' then p_summary is not null
    else exists(select 1 from course_lessons where product_id=p_product_id and published) end;
$$;

create or replace function buykub.require_published_course_lesson()
returns trigger language plpgsql security definer set search_path=buykub,pg_temp as $$
begin
  if new.delivery_type='course' and new.published and not buykub.course_ready(new.id,new.course_format,new.exam_summary)
  then raise exception 'course_not_ready'; end if;
  return new;
end $$;

-- Same as 20261112102000_google_checkout.sql except for the readiness check.
create or replace function buykub.begin_stripe_product_checkout(p_product_id uuid,p_checkout_reference uuid)
returns table(item_name text,price_cents integer) language plpgsql security definer set search_path=buykub,pg_temp as $$
declare v_product products%rowtype; v_key_id uuid;
begin
  -- Check identity before locking a product or creating a stock reservation.
  if auth.uid() is null
    or not(coalesce(auth.jwt()->'app_metadata'->>'provider'='google',false)
      or coalesce(auth.jwt()->'app_metadata'->'providers' ? 'google',false))
    or not exists (
      select 1 from auth.users u where u.id=auth.uid()
        and u.email_confirmed_at is not null
        and length(btrim(u.email)) between 3 and 254
        and btrim(u.email) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ) then raise exception 'google_login_required'; end if;
  if p_checkout_reference is null then raise exception 'invalid_checkout_reference'; end if;
  select p.* into v_product from products p join shops s on s.id=p.shop_id where p.id=p_product_id and p.published and s.published for update of p;
  if not found then raise exception 'product_not_available'; end if;
  if v_product.delivery_type='course' then
    if not buykub.course_ready(v_product.id,v_product.course_format,v_product.exam_summary) then raise exception 'course_not_ready'; end if;
    if buykub.course_access(p_product_id)->>'reason'='active' then raise exception 'course_already_owned'; end if;
  end if;
  insert into stripe_checkout_contexts(checkout_reference,kind,shop_id,product_id,amount_cents,buyer_user_id,course_purchase,course_access_days_snapshot)
  values(p_checkout_reference,'product',v_product.shop_id,v_product.id,v_product.price_cents,
    auth.uid(),v_product.delivery_type='course',
    case when v_product.delivery_type='course' then v_product.course_access_days else null end);
  if v_product.delivery_type='key' then
    select id into v_key_id from product_keys where product_id=v_product.id and status='available' order by created_at,id for update skip locked limit 1;
    if v_key_id is null then raise exception 'sold_out'; end if;
    update product_keys set status='reserved',stripe_checkout_reference=p_checkout_reference,updated_at=now() where id=v_key_id;
  end if;
  return query select v_product.name,v_product.price_cents;
end $$;

-- One progress document per learner and course, written only while access is current.
create table buykub.course_progress(
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references buykub.products(id) on delete cascade,
  state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<=524288),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,product_id)
);
alter table buykub.course_progress enable row level security;
revoke all on buykub.course_progress from public,anon,authenticated;
grant select on buykub.course_progress to authenticated;
grant all on buykub.course_progress to service_role;
create policy "learners read their own progress" on buykub.course_progress for select to authenticated using(
  user_id=(select auth.uid()) and (select (buykub.course_access(product_id)->>'allowed')::boolean)
);

-- Optimistic write: p_base is the updated_at the caller last saw (null for a first save).
-- A stale base returns the stored copy instead of overwriting another device's progress.
create function buykub.save_course_progress(p_product_id uuid,p_state jsonb,p_base timestamptz)
returns jsonb language plpgsql security definer set search_path=buykub,pg_temp as $$
declare v_current course_progress%rowtype; v_saved timestamptz;
begin
  if auth.uid() is null or not coalesce((buykub.course_access(p_product_id)->>'allowed')::boolean,false) then raise exception 'course_access_denied'; end if;
  if p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>524288 then raise exception 'invalid_progress'; end if;
  select * into v_current from course_progress where user_id=auth.uid() and product_id=p_product_id for update;
  if found and (p_base is null or v_current.updated_at<>p_base) then
    return jsonb_build_object('conflict',true,'state',v_current.state,'updated_at',v_current.updated_at);
  end if;
  if found then
    update course_progress set state=p_state,updated_at=clock_timestamp() where user_id=auth.uid() and product_id=p_product_id returning updated_at into v_saved;
  else
    insert into course_progress(user_id,product_id,state) values(auth.uid(),p_product_id,p_state)
    on conflict do nothing returning updated_at into v_saved;
    if v_saved is null then
      select * into v_current from course_progress where user_id=auth.uid() and product_id=p_product_id;
      return jsonb_build_object('conflict',true,'state',v_current.state,'updated_at',v_current.updated_at);
    end if;
  end if;
  return jsonb_build_object('conflict',false,'updated_at',v_saved);
end $$;

revoke all on function buykub.course_ready(uuid,text,jsonb),buykub.save_course_progress(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function buykub.save_course_progress(uuid,jsonb,timestamptz) to authenticated,service_role;
grant execute on function buykub.course_ready(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
