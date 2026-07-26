-- Product-key inventory and atomic mock checkout fulfilment.

create extension if not exists "pgcrypto";

alter table products
  add column if not exists delivery_type text not null default 'file';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_delivery_type_check'
  ) then
    alter table products add constraint products_delivery_type_check
      check (delivery_type in ('file', 'key'));
  end if;
end $$;

alter table orders add column if not exists fulfilment_email_status text;
alter table orders add column if not exists fulfilment_email_attempts integer not null default 0;
alter table orders add column if not exists fulfilment_email_last_error text;
alter table orders add column if not exists fulfilment_email_sent_at timestamptz;
alter table orders add column if not exists fulfilment_token uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_fulfilment_email_status_check'
  ) then
    alter table orders add constraint orders_fulfilment_email_status_check
      check (fulfilment_email_status is null or fulfilment_email_status in ('pending', 'sent', 'failed'));
  end if;
end $$;

create table if not exists product_keys (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  key_value text not null check (char_length(btrim(key_value)) > 0),
  key_fingerprint text not null,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'disabled')),
  assigned_order_id uuid references orders (id) on delete restrict,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_keys_assignment_consistency check (
    (
      status = 'assigned'
      and assigned_order_id is not null
      and assigned_at is not null
    )
    or (
      status in ('available', 'disabled')
      and assigned_order_id is null
      and assigned_at is null
    )
  ),
  unique (product_id, key_fingerprint)
);

create unique index if not exists product_keys_assigned_order_unique
  on product_keys (assigned_order_id)
  where assigned_order_id is not null;
create index if not exists product_keys_inventory_idx
  on product_keys (product_id, status, created_at);

alter table product_keys enable row level security;

drop policy if exists "owners can read product keys" on product_keys;
create policy "owners can read product keys" on product_keys
  for select using (
    exists (
      select 1
      from products
      join shops on shops.id = products.shop_id
      where products.id = product_keys.product_id
        and shops.owner_id = auth.uid()
    )
  );

drop policy if exists "owners can insert available product keys" on product_keys;
create policy "owners can insert available product keys" on product_keys
  for insert with check (
    status = 'available'
    and assigned_order_id is null
    and exists (
      select 1
      from products
      join shops on shops.id = products.shop_id
      where products.id = product_keys.product_id
        and shops.owner_id = auth.uid()
    )
  );

drop policy if exists "owners can update unassigned product keys" on product_keys;
create policy "owners can update unassigned product keys" on product_keys
  for update using (
    status in ('available', 'disabled')
    and exists (
      select 1
      from products
      join shops on shops.id = products.shop_id
      where products.id = product_keys.product_id
        and shops.owner_id = auth.uid()
    )
  ) with check (
    status in ('available', 'disabled')
    and assigned_order_id is null
    and assigned_at is null
  );

create or replace function product_available_key_count(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::integer
  from product_keys
  where product_id = p_product_id
    and status = 'available';
$$;

revoke all on function product_available_key_count(uuid) from public;
grant execute on function product_available_key_count(uuid) to anon, authenticated;

create or replace function import_product_keys(
  p_product_id uuid,
  p_keys text[]
)
returns table (inserted_count integer, duplicate_count integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text;
  v_inserted integer := 0;
  v_duplicates integer := 0;
begin
  if not exists (
    select 1
    from products
    join shops on shops.id = products.shop_id
    where products.id = p_product_id
      and shops.owner_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  foreach v_key in array coalesce(p_keys, array[]::text[]) loop
    v_key := btrim(v_key);
    if v_key = '' then
      continue;
    end if;
    insert into product_keys (product_id, key_value, key_fingerprint)
    values (
      p_product_id,
      v_key,
      encode(extensions.digest(convert_to(v_key, 'UTF8'), 'sha256'), 'hex')
    )
    on conflict (product_id, key_fingerprint) do nothing;
    if found then
      v_inserted := v_inserted + 1;
    else
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  return query select v_inserted, v_duplicates;
end;
$$;

revoke all on function import_product_keys(uuid, text[]) from public;
grant execute on function import_product_keys(uuid, text[]) to authenticated;

create or replace function complete_mock_key_purchase(
  p_product_id uuid,
  p_buyer_email text,
  p_payment_method text
)
returns table (
  order_id uuid,
  assigned_key text,
  email_token uuid,
  remaining_stock integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products%rowtype;
  v_key product_keys%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
begin
  if p_buyer_email is null
    or p_buyer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'invalid_email';
  end if;
  if p_payment_method not in ('promptpay', 'card') then
    raise exception 'invalid_payment_method';
  end if;

  select products.*
  into v_product
  from products
  join shops on shops.id = products.shop_id
  where products.id = p_product_id
    and products.published = true
    and products.delivery_type = 'key'
    and shops.published = true
  for update of products;

  if not found then
    raise exception 'product_not_available';
  end if;

  select *
  into v_key
  from product_keys
  where product_id = p_product_id
    and status = 'available'
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then
    raise exception 'sold_out';
  end if;

  insert into orders (
    id,
    shop_id,
    product_id,
    buyer_name,
    buyer_email,
    payment_method,
    price_cents,
    status,
    mock,
    fulfilment_email_status,
    fulfilment_token
  ) values (
    v_order_id,
    v_product.shop_id,
    v_product.id,
    '',
    lower(btrim(p_buyer_email)),
    p_payment_method,
    v_product.price_cents,
    'paid',
    true,
    'pending',
    v_token
  );

  update product_keys
  set status = 'assigned',
      assigned_order_id = v_order_id,
      assigned_at = now(),
      updated_at = now()
  where id = v_key.id;

  return query
    select
      v_order_id,
      v_key.key_value,
      v_token,
      (
        select count(*)::integer
        from product_keys
        where product_id = p_product_id
          and status = 'available'
      );
end;
$$;

revoke all on function complete_mock_key_purchase(uuid, text, text) from public;
grant execute on function complete_mock_key_purchase(uuid, text, text) to anon, authenticated;
