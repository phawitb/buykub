-- Stripe Test-mode checkout is server-authoritative.  Browser code may create
-- only a short-lived checkout context; Stripe webhooks are the only path that
-- marks an order paid, assigns a product key, or confirms a booking.

create table if not exists stripe_checkout_contexts (
  checkout_reference uuid primary key,
  kind text not null check (kind in ('product', 'service')),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid references products(id) on delete restrict,
  service_id uuid references services(id) on delete restrict,
  booking_id uuid references bookings(id) on delete restrict,
  order_id uuid references orders(id) on delete restrict,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'created'
    check (status in ('created', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint stripe_checkout_contexts_target_check check (
    (kind = 'product' and product_id is not null and service_id is null)
    or (kind = 'service' and service_id is not null and product_id is null and booking_id is not null)
  )
);

alter table stripe_checkout_contexts enable row level security;

alter table orders add column if not exists stripe_checkout_session_id text;
alter table orders add column if not exists stripe_payment_intent_id text;
alter table orders add column if not exists paid_at timestamptz;
create unique index if not exists orders_stripe_checkout_session_unique
  on orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
alter table orders alter column mock set default false;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_status_check'
  ) then
    alter table public.orders drop constraint orders_status_check;
  end if;
  alter table orders add constraint orders_status_check
    check (status in ('pending', 'paid', 'refunded', 'failed'));
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'orders_payment_method_check'
  ) then
    alter table orders drop constraint orders_payment_method_check;
  end if;
  alter table orders add constraint orders_payment_method_check
    check (payment_method in ('promptpay', 'card', 'stripe') or payment_method is null);
end $$;

alter table bookings add column if not exists stripe_checkout_session_id text;
alter table bookings add column if not exists stripe_payment_intent_id text;
alter table bookings add column if not exists paid_at timestamptz;
create unique index if not exists bookings_stripe_checkout_session_unique
  on bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_status_check'
  ) then
    alter table public.bookings drop constraint bookings_status_check;
  end if;
  alter table bookings alter column status set default 'pending';
  alter table bookings add constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'failed'));
end $$;

alter table product_keys add column if not exists stripe_checkout_reference uuid
  references stripe_checkout_contexts(checkout_reference) on delete set null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'product_keys_status_check'
  ) then
    alter table product_keys drop constraint product_keys_status_check;
  end if;
  if exists (
    select 1 from pg_constraint where conname = 'product_keys_assignment_consistency'
  ) then
    alter table product_keys drop constraint product_keys_assignment_consistency;
  end if;
  alter table product_keys add constraint product_keys_status_check
    check (status in ('available', 'reserved', 'assigned', 'disabled'));
  alter table product_keys add constraint product_keys_assignment_consistency check (
    (status = 'assigned' and assigned_order_id is not null and assigned_at is not null and stripe_checkout_reference is null)
    or (status = 'reserved' and assigned_order_id is null and assigned_at is null and stripe_checkout_reference is not null)
    or (status in ('available', 'disabled') and assigned_order_id is null and assigned_at is null and stripe_checkout_reference is null)
  );
end $$;

create or replace function begin_stripe_product_checkout(
  p_product_id uuid,
  p_checkout_reference uuid
)
returns table (item_name text, price_cents integer)
language plpgsql security definer set search_path = public
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

  insert into stripe_checkout_contexts(checkout_reference, kind, shop_id, product_id)
  values (p_checkout_reference, 'product', v_product.shop_id, v_product.id);

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

create or replace function begin_stripe_service_checkout(
  p_service_id uuid,
  p_checkout_reference uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_scheduled_at timestamptz
)
returns table (item_name text, price_cents integer, buyer_email text)
language plpgsql security definer set search_path = public
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
  insert into stripe_checkout_contexts(checkout_reference, kind, shop_id, service_id, booking_id)
  values (p_checkout_reference, 'service', v_service.shop_id, v_service.id, v_booking_id);
  return query select v_service.name, v_service.price_cents, lower(btrim(p_buyer_email));
end;
$$;

create or replace function attach_stripe_checkout_session(
  p_checkout_reference uuid,
  p_stripe_session_id text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update stripe_checkout_contexts set stripe_session_id = p_stripe_session_id
  where checkout_reference = p_checkout_reference and status = 'created' and stripe_session_id is null;
  if not found then raise exception 'checkout_context_not_available'; end if;
  update bookings set stripe_checkout_session_id = p_stripe_session_id
  where id = (select booking_id from stripe_checkout_contexts where checkout_reference = p_checkout_reference);
end;
$$;

create or replace function cancel_stripe_checkout(p_checkout_reference uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update product_keys set status = 'available', stripe_checkout_reference = null, updated_at = now()
  where stripe_checkout_reference = p_checkout_reference and status = 'reserved';
  update bookings set status = 'cancelled'
  where id = (select booking_id from stripe_checkout_contexts where checkout_reference = p_checkout_reference)
    and status = 'pending';
  update stripe_checkout_contexts set status = 'cancelled'
  where checkout_reference = p_checkout_reference and status = 'created';
end;
$$;

create or replace function finalize_stripe_checkout(
  p_checkout_reference uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_buyer_email text,
  p_buyer_name text
)
returns table (kind text, order_id uuid, email_token uuid, booking_id uuid)
language plpgsql security definer set search_path = public
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
    values (v_order_id, v_context.shop_id, v_context.product_id, nullif(btrim(coalesce(p_buyer_name, '')), ''), lower(btrim(p_buyer_email)), 'stripe', v_product.price_cents, 'paid', false,
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

create or replace function expire_stripe_checkout(p_stripe_session_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_reference uuid;
begin
  select checkout_reference into v_reference from stripe_checkout_contexts
  where stripe_session_id = p_stripe_session_id and status = 'created';
  if v_reference is not null then perform cancel_stripe_checkout(v_reference); end if;
end;
$$;

create or replace function get_stripe_checkout_success(p_stripe_session_id text)
returns table (
  kind text, status text, item_name text, order_id uuid, assigned_key text,
  email_status text, booking_id uuid, booking_status text, meet_url text
)
language sql stable security definer set search_path = public
as $$
  select c.kind, c.status,
    coalesce(p.name, s.name), o.id, k.key_value, o.fulfilment_email_status,
    b.id, b.status, b.google_meet_url
  from stripe_checkout_contexts c
  left join products p on p.id = c.product_id
  left join services s on s.id = c.service_id
  left join orders o on o.id = c.order_id
  left join product_keys k on k.assigned_order_id = o.id and k.status = 'assigned'
  left join bookings b on b.id = c.booking_id
  where c.stripe_session_id = p_stripe_session_id;
$$;

revoke all on function begin_stripe_product_checkout(uuid, uuid) from public;
revoke all on function begin_stripe_service_checkout(uuid, uuid, text, text, timestamptz) from public;
revoke all on function attach_stripe_checkout_session(uuid, text) from public;
revoke all on function cancel_stripe_checkout(uuid) from public;
revoke all on function get_stripe_checkout_success(text) from public;
grant execute on function begin_stripe_product_checkout(uuid, uuid) to anon, authenticated;
grant execute on function begin_stripe_service_checkout(uuid, uuid, text, text, timestamptz) to anon, authenticated;
grant execute on function attach_stripe_checkout_session(uuid, text) to anon, authenticated;
grant execute on function cancel_stripe_checkout(uuid) to anon, authenticated;
grant execute on function get_stripe_checkout_success(text) to anon, authenticated;

drop function if exists complete_mock_key_purchase(uuid, text, text);
