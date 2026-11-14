-- Preserve the amount agreed at checkout even if a seller later changes the price.
begin;
alter table buykub.stripe_checkout_contexts add column amount_cents integer check (amount_cents >= 0);
update buykub.stripe_checkout_contexts c set amount_cents = coalesce(
 (select o.price_cents from buykub.orders o where o.id=c.order_id),
 (select b.price_cents from buykub.bookings b where b.id=c.booking_id),
 (select p.price_cents from buykub.products p where p.id=c.product_id)) where amount_cents is null;
alter table buykub.stripe_checkout_contexts alter column amount_cents set not null;
create or replace function buykub.begin_stripe_product_checkout(
  p_product_id uuid,
  p_checkout_reference uuid
)
returns table (item_name text, price_cents integer)
language plpgsql security definer set search_path = buykub
as $$
declare
  v_product products%rowtype;
  v_key_id uuid;
begin
  if p_checkout_reference is null then raise exception 'invalid_checkout_reference'; end if;
  select products.* into v_product
  from products join shops on shops.id = products.shop_id
  where products.id = p_product_id and products.published = true and shops.published = true
  for update of products;
  if not found then raise exception 'product_not_available'; end if;

  insert into stripe_checkout_contexts(checkout_reference, kind, shop_id, product_id, amount_cents)
  values (p_checkout_reference, 'product', v_product.shop_id, v_product.id, v_product.price_cents);

  if v_product.delivery_type = 'key' then
    select id into v_key_id from product_keys
    where product_id = v_product.id and status = 'available'
    order by created_at, id for update skip locked limit 1;
    if v_key_id is null then
      delete from stripe_checkout_contexts where checkout_reference = p_checkout_reference;
      raise exception 'sold_out';
    end if;
    update product_keys set status = 'reserved', stripe_checkout_reference = p_checkout_reference,
      updated_at = now() where id = v_key_id;
  end if;

  return query select v_product.name, v_product.price_cents;
end;
$$;

create or replace function buykub.begin_stripe_service_checkout(
  p_service_id uuid,
  p_checkout_reference uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_scheduled_at timestamptz
)
returns table (item_name text, price_cents integer, buyer_email text)
language plpgsql security definer set search_path = buykub
as $$
declare
  v_service services%rowtype;
  v_booking_id uuid := gen_random_uuid();
begin
  if p_buyer_name is null or btrim(p_buyer_name) = ''
    or p_buyer_email is null or p_buyer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_scheduled_at <= now()
  then raise exception 'invalid_booking'; end if;
  select services.* into v_service
  from services join shops on shops.id = services.shop_id
  where services.id = p_service_id and services.published = true and shops.published = true
  for update of services;
  if not found then raise exception 'service_not_available'; end if;

  insert into bookings(id, shop_id, service_id, buyer_name, buyer_email, scheduled_at, price_cents, status)
  values (v_booking_id, v_service.shop_id, v_service.id, btrim(p_buyer_name), lower(btrim(p_buyer_email)), p_scheduled_at, v_service.price_cents, 'pending');
  insert into stripe_checkout_contexts(checkout_reference, kind, shop_id, service_id, booking_id, amount_cents)
  values (p_checkout_reference, 'service', v_service.shop_id, v_service.id, v_booking_id, v_service.price_cents);
  return query select v_service.name, v_service.price_cents, lower(btrim(p_buyer_email));
end;
$$;

create or replace function buykub.finalize_stripe_checkout(
  p_checkout_reference uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_buyer_email text,
  p_buyer_name text
)
returns table (kind text, order_id uuid, email_token uuid, booking_id uuid)
language plpgsql security definer set search_path = buykub
as $$
declare
  v_context stripe_checkout_contexts%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_product products%rowtype;
begin
  select * into v_context from stripe_checkout_contexts
  where checkout_reference = p_checkout_reference and stripe_session_id = p_stripe_session_id
  for update;
  if not found then raise exception 'checkout_not_found'; end if;
  if v_context.status = 'completed' then
    return query select v_context.kind, v_context.order_id, null::uuid, v_context.booking_id;
    return;
  end if;
  if v_context.status <> 'created' then raise exception 'checkout_not_active'; end if;

  if v_context.kind = 'product' then
    select * into v_product from products where id = v_context.product_id;
    insert into orders(id, shop_id, product_id, buyer_name, buyer_email, payment_method, price_cents, status, mock, fulfilment_email_status, fulfilment_token, stripe_checkout_session_id, stripe_payment_intent_id, paid_at)
    values (v_order_id, v_context.shop_id, v_context.product_id, nullif(btrim(coalesce(p_buyer_name, '')), ''), lower(btrim(p_buyer_email)), 'stripe', v_context.amount_cents, 'paid', false,
      case when v_product.delivery_type = 'key' then 'pending' else null end,
      case when v_product.delivery_type = 'key' then v_token else null end,
      p_stripe_session_id, p_stripe_payment_intent_id, now());
    update product_keys set status = 'assigned', stripe_checkout_reference = null,
      assigned_order_id = v_order_id, assigned_at = now(), updated_at = now()
    where stripe_checkout_reference = p_checkout_reference and status = 'reserved';
    update stripe_checkout_contexts set status = 'completed', order_id = v_order_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id, completed_at = now()
    where checkout_reference = p_checkout_reference;
    return query select 'product'::text, v_order_id,
      case when v_product.delivery_type = 'key' then v_token else null end, null::uuid;
  else
    update bookings set status = 'confirmed', buyer_name = nullif(btrim(coalesce(p_buyer_name, '')), ''),
      buyer_email = lower(btrim(p_buyer_email)), stripe_payment_intent_id = p_stripe_payment_intent_id,
      paid_at = now() where id = v_context.booking_id;
    update stripe_checkout_contexts set status = 'completed', stripe_payment_intent_id = p_stripe_payment_intent_id,
      completed_at = now() where checkout_reference = p_checkout_reference;
    return query select 'service'::text, null::uuid, null::uuid, v_context.booking_id;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
-- END BUYKUB amount migration
