-- Require verified Google identity for every new purchase, including free products.
-- Existing receipt, download, refund and course ownership behavior is unchanged.
begin;
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
    if not exists(select 1 from course_lessons where product_id=p_product_id and published) then raise exception 'course_not_ready'; end if;
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

-- Stripe customer email can be edited, including on hosted free checkouts.
-- Bind every new order to its initiating account; leave legacy guest contexts alone.
create or replace function buykub.bind_course_order()
returns trigger language plpgsql security definer set search_path=buykub,pg_temp as $$
declare context stripe_checkout_contexts%rowtype;
begin
  select * into context from stripe_checkout_contexts where stripe_session_id=new.stripe_checkout_session_id and product_id=new.product_id;
  if found and (context.buyer_user_id is not null or context.course_purchase) then
    if context.buyer_user_id is null or new.paid_at is null then raise exception 'course_buyer_required'; end if;
    select lower(btrim(u.email)) into new.buyer_email from auth.users u where u.id=context.buyer_user_id;
    if new.buyer_email is null or new.buyer_email='' then raise exception 'course_buyer_email_required'; end if;
    new.buyer_user_id:=context.buyer_user_id;
    if context.course_purchase then
      new.course_purchase:=true;
      new.course_expires_at:=case when context.course_access_days_snapshot is null then null else new.paid_at+make_interval(days=>context.course_access_days_snapshot) end;
    end if;
  end if;
  return new;
end $$;

revoke all on function buykub.begin_stripe_product_checkout(uuid,uuid) from public,anon;
grant execute on function buykub.begin_stripe_product_checkout(uuid,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
