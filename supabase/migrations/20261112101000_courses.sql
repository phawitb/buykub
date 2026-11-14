-- Paid courses in the isolated BUYKUB schema; legacy data remains intact.
begin;
alter table buykub.products drop constraint products_delivery_type_check;
alter table buykub.products add constraint products_delivery_type_check check(delivery_type in ('file','key','course'));
alter table buykub.products add column course_access_days integer check(course_access_days between 1 and 36500);
alter table buykub.stripe_checkout_contexts
  add column buyer_user_id uuid references auth.users(id),
  add column course_purchase boolean not null default false,
  add column course_access_days_snapshot integer check(course_access_days_snapshot between 1 and 36500);
alter table buykub.orders
  add column buyer_user_id uuid references auth.users(id),
  add column course_purchase boolean not null default false,
  add column course_expires_at timestamptz;
create index orders_course_buyer on buykub.orders(buyer_user_id,product_id) where course_purchase;

create table buykub.course_lessons(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references buykub.products(id) on delete cascade,
  title text not null check(length(btrim(title)) between 1 and 200),
  position integer not null default 0 check(position>=0),
  content_html text not null default '' check(length(content_html)<=100000),
  youtube_url text check(length(youtube_url)<=2000),
  documents jsonb not null default '[]' check(jsonb_typeof(documents)='array' and jsonb_array_length(documents)<=20),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create index course_lessons_order on buykub.course_lessons(product_id,position,id);
alter table buykub.course_lessons enable row level security;
revoke all on buykub.course_lessons from public,anon,authenticated;
grant select on buykub.course_lessons to authenticated;
grant all on buykub.course_lessons to service_role;

create function buykub.course_access(p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path=buykub,pg_temp as $$
declare v_expiry timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('allowed',false,'reason','not_purchased','expires_at',null); end if;
  if exists(select 1 from products p join shops s on s.id=p.shop_id where p.id=p_product_id and p.delivery_type='course' and s.owner_id=auth.uid()) then
    return jsonb_build_object('allowed',true,'reason','owner','expires_at',null);
  end if;
  select course_expires_at into v_expiry from orders where product_id=p_product_id and buyer_user_id=auth.uid() and course_purchase and status='paid' and paid_at is not null
    and (course_expires_at is null or course_expires_at>now()) order by course_expires_at desc nulls first limit 1;
  if found then return jsonb_build_object('allowed',true,'reason','active','expires_at',v_expiry); end if;
  if exists(select 1 from orders where product_id=p_product_id and buyer_user_id=auth.uid() and course_purchase and status='paid' and paid_at is not null) then
    select max(course_expires_at) into v_expiry from orders where product_id=p_product_id and buyer_user_id=auth.uid() and course_purchase and status='paid';
    return jsonb_build_object('allowed',false,'reason','expired','expires_at',v_expiry);
  end if;
  if exists(select 1 from orders where product_id=p_product_id and buyer_user_id=auth.uid() and course_purchase and status='refunded') then
    return jsonb_build_object('allowed',false,'reason','refunded','expires_at',null);
  end if;
  return jsonb_build_object('allowed',false,'reason','not_purchased','expires_at',null);
end $$;

create policy "course content for owner or entitled buyer" on buykub.course_lessons for select to authenticated using(
  (select buykub.course_access(product_id)->>'reason')='owner'
  or (published and (select (buykub.course_access(product_id)->>'allowed')::boolean))
);
create policy "course buyers read purchased products" on buykub.products for select to authenticated using(
  delivery_type='course' and (select (buykub.course_access(id)->>'allowed')::boolean)
);

create function buykub.my_courses()
returns table(product_id uuid,name text,expires_at timestamptz,access_status text)
language sql stable security definer set search_path=buykub,pg_temp as $$
  select p.id,p.name,(a.value->>'expires_at')::timestamptz,a.value->>'reason'
  from products p cross join lateral (select buykub.course_access(p.id) as value) a
  where p.delivery_type='course' and auth.uid() is not null and exists(
    select 1 from orders o where o.product_id=p.id and o.buyer_user_id=auth.uid() and o.course_purchase and o.paid_at is not null)
  order by p.name,p.id;
$$;

create function buykub.save_course_lessons(p_product_id uuid,p_lessons jsonb)
returns void language plpgsql security definer set search_path=buykub,pg_temp as $$
declare lesson jsonb; doc jsonb; lesson_id uuid; lesson_ids uuid[]:='{}'; i integer:=0;
begin
  perform 1 from products p join shops s on s.id=p.shop_id where p.id=p_product_id and p.delivery_type='course' and s.owner_id=auth.uid() for update of p;
  if not found then raise exception 'course_access_denied'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons)<>'array' or jsonb_array_length(p_lessons)>100 then raise exception 'invalid_curriculum'; end if;
  for lesson in select value from jsonb_array_elements(p_lessons) loop
    lesson_id:=(lesson->>'id')::uuid;
    if lesson_id is null or lesson_id=any(lesson_ids) then raise exception 'invalid_lesson_id'; end if;
    if exists(select 1 from course_lessons where id=lesson_id and product_id<>p_product_id) then raise exception 'lesson_access_denied'; end if;
    lesson_ids:=array_append(lesson_ids,lesson_id);
    if coalesce(jsonb_typeof(lesson->'documents'),'array')<>'array' then raise exception 'invalid_documents'; end if;
    for doc in select value from jsonb_array_elements(coalesce(lesson->'documents','[]')) loop
      if coalesce(doc->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or length(btrim(coalesce(doc->>'name',''))) not between 1 and 255
        or ((nullif(doc->>'path','') is null)=(nullif(doc->>'url','') is null)) then raise exception 'invalid_document'; end if;
      if nullif(doc->>'path','') is not null and (
        doc->>'path' not like auth.uid()::text||'/%'
        or doc->>'path' !~ '^[-a-zA-Z0-9_./]+$'
        or doc->>'path' ~ '(^|/)[.]{0,2}(/|$)'
      ) then raise exception 'document_access_denied'; end if;
      if nullif(doc->>'url','') is not null and (length(doc->>'url')>4000 or doc->>'url' !~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$') then raise exception 'invalid_document_url'; end if;
    end loop;
    insert into course_lessons(id,product_id,title,position,content_html,youtube_url,documents,published)
    values(lesson_id,p_product_id,btrim(lesson->>'title'),i,coalesce(lesson->>'content_html',''),nullif(lesson->>'youtube_url',''),coalesce(lesson->'documents','[]'),coalesce((lesson->>'published')::boolean,false))
    on conflict(id) do update set title=excluded.title,position=excluded.position,content_html=excluded.content_html,youtube_url=excluded.youtube_url,documents=excluded.documents,published=excluded.published,updated_at=now();
    i:=i+1;
  end loop;
  delete from course_lessons where product_id=p_product_id and not(id=any(lesson_ids));
end $$;

create function buykub.can_read_course_document(p_path text)
returns boolean language sql stable security definer set search_path=buykub,pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from course_lessons l join products p on p.id=l.product_id join shops s on s.id=p.shop_id
    where (l.published or s.owner_id=auth.uid()) and (buykub.course_access(p.id)->>'allowed')::boolean
    and p_path like s.owner_id::text||'/%' and p_path ~ '^[-a-zA-Z0-9_./]+$'
    and p_path !~ '(^|/)[.]{0,2}(/|$)'
    and exists(select 1 from jsonb_array_elements(l.documents) d where d->>'path'=p_path));
$$;
-- Buyer downloads are signed only by the server after entitlement checks.
-- Storage SELECT would let buyers choose arbitrary signed URL lifetimes.

create or replace function buykub.begin_stripe_product_checkout(p_product_id uuid,p_checkout_reference uuid)
returns table(item_name text,price_cents integer) language plpgsql security definer set search_path=buykub,pg_temp as $$
declare v_product products%rowtype; v_key_id uuid;
begin
  if p_checkout_reference is null then raise exception 'invalid_checkout_reference'; end if;
  select p.* into v_product from products p join shops s on s.id=p.shop_id where p.id=p_product_id and p.published and s.published for update of p;
  if not found then raise exception 'product_not_available'; end if;
  if v_product.delivery_type='course' then
    if auth.uid() is null or not(coalesce(auth.jwt()->'app_metadata'->>'provider'='google',false) or coalesce(auth.jwt()->'app_metadata'->'providers' ? 'google',false)) then raise exception 'google_login_required'; end if;
    if not exists(select 1 from course_lessons where product_id=p_product_id and published) then raise exception 'course_not_ready'; end if;
    if buykub.course_access(p_product_id)->>'reason'='active' then raise exception 'course_already_owned'; end if;
  end if;
  insert into stripe_checkout_contexts(checkout_reference,kind,shop_id,product_id,amount_cents,buyer_user_id,course_purchase,course_access_days_snapshot)
  values(p_checkout_reference,'product',v_product.shop_id,v_product.id,v_product.price_cents,
    case when v_product.delivery_type='course' then auth.uid() else null end,v_product.delivery_type='course',
    case when v_product.delivery_type='course' then v_product.course_access_days else null end);
  if v_product.delivery_type='key' then
    select id into v_key_id from product_keys where product_id=v_product.id and status='available' order by created_at,id for update skip locked limit 1;
    if v_key_id is null then raise exception 'sold_out'; end if;
    update product_keys set status='reserved',stripe_checkout_reference=p_checkout_reference,updated_at=now() where id=v_key_id;
  end if;
  return query select v_product.name,v_product.price_cents;
end $$;

create function buykub.bind_course_order()
returns trigger language plpgsql security definer set search_path=buykub,pg_temp as $$
declare context stripe_checkout_contexts%rowtype;
begin
  select * into context from stripe_checkout_contexts where stripe_session_id=new.stripe_checkout_session_id and product_id=new.product_id;
  if found and context.course_purchase then
    if context.buyer_user_id is null or new.paid_at is null then raise exception 'course_buyer_required'; end if;
    select lower(btrim(u.email)) into new.buyer_email from auth.users u where u.id=context.buyer_user_id;
    if new.buyer_email is null or new.buyer_email='' then raise exception 'course_buyer_email_required'; end if;
    new.buyer_user_id:=context.buyer_user_id;
    new.course_purchase:=true;
    new.course_expires_at:=case when context.course_access_days_snapshot is null then null else new.paid_at+make_interval(days=>context.course_access_days_snapshot) end;
  end if;
  return new;
end $$;
create trigger bind_course_order before insert on buykub.orders for each row execute function buykub.bind_course_order();

create function buykub.require_published_course_lesson()
returns trigger language plpgsql security definer set search_path=buykub,pg_temp as $$
begin
  if new.delivery_type='course' and new.published and not exists(
    select 1 from course_lessons where product_id=new.id and published
  ) then raise exception 'course_not_ready'; end if;
  return new;
end $$;
create trigger require_published_course_lesson before insert or update on buykub.products for each row execute function buykub.require_published_course_lesson();

create function buykub.protect_product_delivery_type()
returns trigger language plpgsql security definer set search_path=buykub,pg_temp as $$
begin
  if old.delivery_type<>new.delivery_type and (exists(select 1 from stripe_checkout_contexts where product_id=old.id) or exists(select 1 from orders where product_id=old.id)) then
    raise exception 'สินค้าที่มีรายการชำระเงินแล้วไม่สามารถเปลี่ยนประเภทได้ กรุณาสร้างสินค้าใหม่';
  end if;
  return new;
end $$;
create trigger protect_product_delivery_type before update of delivery_type on buykub.products for each row execute function buykub.protect_product_delivery_type();

create or replace function buykub.get_product_email_delivery(p_order_id uuid,p_email_token uuid)
returns jsonb language sql stable security definer set search_path=buykub,pg_temp as $$
  select jsonb_build_object('buyer_email',o.buyer_email,'status',o.status,'session_id',o.stripe_checkout_session_id,
    'product_name',p.name,'shop_name',s.name,'key_value',k.key_value,'delivery_type',p.delivery_type,
    'product_id',p.id,'course_expires_at',o.course_expires_at)
  from orders o join products p on p.id=o.product_id join shops s on s.id=o.shop_id
  left join product_keys k on k.assigned_order_id=o.id and k.status='assigned'
  where o.id=p_order_id and o.fulfilment_token=p_email_token and o.payment_method='stripe' and o.paid_at is not null
    and o.stripe_checkout_session_id is not null and o.buyer_email is not null
    and (p.delivery_type in ('file','course') or k.key_value is not null);
$$;

-- Public receipts contain only the product identifier, never paid lesson content.
create function buykub.get_checkout_course(p_receipt_id text)
returns jsonb language sql stable security definer set search_path=buykub,pg_temp as $$
  select jsonb_build_object('delivery_type',p.delivery_type,'product_id',p.id,'course_expires_at',o.course_expires_at)
  from stripe_checkout_contexts c join products p on p.id=c.product_id left join orders o on o.id=c.order_id
  where c.stripe_session_id=p_receipt_id;
$$;

revoke all on function buykub.course_access(uuid),buykub.my_courses(),buykub.save_course_lessons(uuid,jsonb),buykub.can_read_course_document(text),buykub.bind_course_order(),buykub.require_published_course_lesson(),buykub.protect_product_delivery_type(),buykub.get_checkout_course(text) from public,anon,authenticated;
grant execute on function buykub.course_access(uuid),buykub.my_courses(),buykub.save_course_lessons(uuid,jsonb),buykub.can_read_course_document(text) to authenticated,service_role;
grant execute on function buykub.get_checkout_course(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
