-- Framelink schema: run this once in Supabase Dashboard → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).

create extension if not exists "pgcrypto";

-- One row per authenticated user.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  google_provider_token text,
  google_provider_refresh_token text,
  google_calendar_connected_at timestamptz,
  created_at timestamptz not null default now()
);

-- One shop per user (a biolink storefront).
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  bio text check (char_length(bio) <= 160),
  avatar_url text,
  cover_url text,
  accent_color text not null default '#0a0a0a',
  payout_method text not null default 'promptpay' check (payout_method in ('promptpay', 'bank')),
  promptpay_id text,
  bank_details text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists shops_owner_id_idx on shops (owner_id);

-- Digital products listed on a shop.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'other',
  price_cents integer not null check (price_cents >= 0),
  compare_price_cents integer,
  highlights text[] not null default '{}',
  faq jsonb not null default '[]',
  images text[] not null default '{}',
  file_url text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_shop_id_idx on products (shop_id);

-- Migration: add columns that a prior run of this script (before this
-- version) wouldn't have created, since `create table if not exists` is a
-- no-op on tables that already exist.
alter table shops add column if not exists cover_url text;
alter table shops add column if not exists accent_color text not null default '#0a0a0a';
alter table shops add column if not exists payout_method text not null default 'promptpay';
alter table shops add column if not exists promptpay_id text;
alter table shops add column if not exists bank_details text;

alter table products add column if not exists category text not null default 'other';
alter table products add column if not exists compare_price_cents integer;
alter table products add column if not exists highlights text[] not null default '{}';
alter table products add column if not exists faq jsonb not null default '[]';
alter table products add column if not exists images text[] not null default '{}';
alter table products add column if not exists file_url text;
alter table products add column if not exists slug text;
alter table products add column if not exists description_html text;
alter table products add column if not exists file_path text;
alter table products add column if not exists file_name text;
alter table products add column if not exists file_size bigint;
alter table products add column if not exists file_mime_type text;
alter table products add column if not exists images_v2 jsonb not null default '[]';
alter table products add column if not exists updated_at timestamptz not null default now();
alter table products add column if not exists delivery_type text not null default 'file';

-- Legacy products predate shop-scoped slugs. The UUID suffix is stable and
-- collision-safe; newly authored products receive human-readable slugs.
update products
set slug = 'product-' || left(id::text, 8)
where slug is null;

create unique index if not exists products_shop_slug_unique
  on products (shop_id, slug)
  where slug is not null;

-- Bookable services (separate from digital products, like Pixza's "จองบริการ").
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null default 30,
  image_url text,
  image_path text,
  meet_link text,
  availability jsonb not null default '{"days": [1,2,3,4,5], "start": "09:00", "end": "18:00", "buffer_minutes": 15, "advance_days": 30}',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists services_shop_id_idx on services (shop_id);

-- Demo orders for digital products — no real payment gateway; a "buy" click
-- inserts a row here directly so the dashboard has real data to show.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  buyer_email text,
  price_cents integer not null,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists orders_shop_id_idx on orders (shop_id);

alter table orders add column if not exists buyer_name text;
alter table orders add column if not exists payment_method text;
alter table orders add column if not exists mock boolean not null default true;
alter table orders add column if not exists fulfilment_email_status text;
alter table orders add column if not exists fulfilment_email_attempts integer not null default 0;
alter table orders add column if not exists fulfilment_email_last_error text;
alter table orders add column if not exists fulfilment_email_sent_at timestamptz;
alter table orders add column if not exists fulfilment_token uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
  ) then
    alter table orders
      add constraint orders_payment_method_check
      check (payment_method in ('promptpay', 'card'));
  end if;
end $$;

-- Demo booking requests for services.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  buyer_name text,
  buyer_email text,
  scheduled_at timestamptz not null,
  price_cents integer not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_shop_id_idx on bookings (shop_id);

-- Storefront page views, for a simplified 2-step Analytics funnel
-- (view → purchase). Pixza tracks a longer funnel; we don't have a real
-- checkout step to instrument, so this is intentionally simpler.
create table if not exists shop_views (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists shop_views_shop_id_idx on shop_views (shop_id);

-- Product conversion events. visitor_id is an anonymous browser UUID used only
-- for 30-minute client-side deduplication; no names, emails, or IPs are stored.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  product_id uuid references products (id) on delete cascade,
  event_type text not null check (
    event_type in ('view_product', 'click_buy', 'open_checkout', 'purchase')
  ),
  visitor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_shop_created_idx
  on analytics_events (shop_id, created_at desc);
create index if not exists analytics_events_product_created_idx
  on analytics_events (product_id, created_at desc);

-- Row Level Security -----------------------------------------------------

alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table services enable row level security;
alter table orders enable row level security;
alter table bookings enable row level security;
alter table shop_views enable row level security;
alter table analytics_events enable row level security;

drop policy if exists "profiles are self-readable" on profiles;
create policy "profiles are self-readable" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles are self-writable" on profiles;
create policy "profiles are self-writable" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles are self-updatable" on profiles;
create policy "profiles are self-updatable" on profiles
  for update using (auth.uid() = id);

drop policy if exists "published shops are public" on shops;
create policy "published shops are public" on shops
  for select using (published = true or owner_id = auth.uid());

drop policy if exists "owners manage their shop" on shops;
create policy "owners manage their shop" on shops
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "published products are public" on products;
create policy "published products are public" on products
  for select using (
    published = true
    or exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "owners manage their products" on products;
create policy "owners manage their products" on products
  for all using (
    exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
  ) with check (
    exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "published services are public" on services;
create policy "published services are public" on services
  for select using (
    published = true
    or exists (select 1 from shops where shops.id = services.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "owners manage their services" on services;
create policy "owners manage their services" on services
  for all using (
    exists (select 1 from shops where shops.id = services.shop_id and shops.owner_id = auth.uid())
  ) with check (
    exists (select 1 from shops where shops.id = services.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "anyone can create a demo order" on orders;
create policy "anyone can create a demo order" on orders
  for insert with check (true);

drop policy if exists "owners can read their orders" on orders;
create policy "owners can read their orders" on orders
  for select using (
    exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "owners can update their orders" on orders;
create policy "owners can update their orders" on orders
  for update using (
    exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
  ) with check (
    exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "anyone can create a demo booking" on bookings;
create policy "anyone can create a demo booking" on bookings
  for insert with check (true);

drop policy if exists "owners can read their bookings" on bookings;
create policy "owners can read their bookings" on bookings
  for select using (
    exists (select 1 from shops where shops.id = bookings.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "owners can update their bookings" on bookings;
create policy "owners can update their bookings" on bookings
  for update using (
    exists (select 1 from shops where shops.id = bookings.shop_id and shops.owner_id = auth.uid())
  ) with check (
    exists (select 1 from shops where shops.id = bookings.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "anyone can log a shop view" on shop_views;
create policy "anyone can log a shop view" on shop_views
  for insert with check (true);

drop policy if exists "owners can read their shop views" on shop_views;
create policy "owners can read their shop views" on shop_views
  for select using (
    exists (select 1 from shops where shops.id = shop_views.shop_id and shops.owner_id = auth.uid())
  );

drop policy if exists "anyone can create analytics events" on analytics_events;
create policy "anyone can create analytics events" on analytics_events
  for insert with check (true);

drop policy if exists "owners can read analytics events" on analytics_events;
create policy "owners can read analytics events" on analytics_events
  for select using (
    exists (
      select 1
      from shops
      where shops.id = analytics_events.shop_id
        and shops.owner_id = auth.uid()
    )
  );

-- Storage -----------------------------------------------------------------
-- Keep legacy shop-assets public for existing profile/cover/product URLs.
-- New product images and product files use separate buckets so downloadable
-- product files are never exposed through a permanent public URL.

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files', 'product-files', false, 524288000)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "shop-assets are publicly readable" on storage.objects;
create policy "shop-assets are publicly readable" on storage.objects
  for select using (bucket_id = 'shop-assets');

drop policy if exists "owners upload to their own folder" on storage.objects;
create policy "owners upload to their own folder" on storage.objects
  for insert with check (
    bucket_id = 'shop-assets' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners update their own files" on storage.objects;
create policy "owners update their own files" on storage.objects
  for update using (
    bucket_id = 'shop-assets' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners delete their own files" on storage.objects;
create policy "owners delete their own files" on storage.objects
  for delete using (
    bucket_id = 'shop-assets' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "owners upload product images" on storage.objects;
create policy "owners upload product images" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners update product images" on storage.objects;
create policy "owners update product images" on storage.objects
  for update using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners delete product images" on storage.objects;
create policy "owners delete product images" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners read product files" on storage.objects;
create policy "owners read product files" on storage.objects
  for select using (
    bucket_id = 'product-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners upload product files" on storage.objects;
create policy "owners upload product files" on storage.objects
  for insert with check (
    bucket_id = 'product-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners update product files" on storage.objects;
create policy "owners update product files" on storage.objects
  for update using (
    bucket_id = 'product-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners delete product files" on storage.objects;
create policy "owners delete product files" on storage.objects
  for delete using (
    bucket_id = 'product-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Product-key inventory -------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_delivery_type_check'
  ) then
    alter table products add constraint products_delivery_type_check
      check (delivery_type in ('file', 'key'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'orders_fulfilment_email_status_check'
  ) then
    alter table orders add constraint orders_fulfilment_email_status_check
      check (
        fulfilment_email_status is null
        or fulfilment_email_status in ('pending', 'sent', 'failed')
      );
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
      select 1 from products
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
      select 1 from products
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
      select 1 from products
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
set search_path = public
as $$
  select count(*)::integer
  from product_keys
  where product_id = p_product_id and status = 'available';
$$;

revoke all on function product_available_key_count(uuid) from public;
grant execute on function product_available_key_count(uuid) to anon, authenticated;

create or replace function import_product_keys(p_product_id uuid, p_keys text[])
returns table (inserted_count integer, duplicate_count integer)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_key text;
  v_inserted integer := 0;
  v_duplicates integer := 0;
begin
  if not exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = p_product_id and shops.owner_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  foreach v_key in array coalesce(p_keys, array[]::text[]) loop
    v_key := btrim(v_key);
    if v_key = '' then continue; end if;
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

  select products.* into v_product
  from products
  join shops on shops.id = products.shop_id
  where products.id = p_product_id
    and products.published = true
    and products.delivery_type = 'key'
    and shops.published = true
  for update of products;
  if not found then raise exception 'product_not_available'; end if;

  select * into v_key
  from product_keys
  where product_id = p_product_id and status = 'available'
  order by created_at, id
  for update skip locked
  limit 1;
  if not found then raise exception 'sold_out'; end if;

  insert into orders (
    id, shop_id, product_id, buyer_name, buyer_email, payment_method,
    price_cents, status, mock, fulfilment_email_status, fulfilment_token
  ) values (
    v_order_id, v_product.shop_id, v_product.id, '',
    lower(btrim(p_buyer_email)), p_payment_method, v_product.price_cents,
    'paid', true, 'pending', v_token
  );

  update product_keys
  set status = 'assigned',
      assigned_order_id = v_order_id,
      assigned_at = now(),
      updated_at = now()
  where id = v_key.id;

  return query select
    v_order_id,
    v_key.key_value,
    v_token,
    (
      select count(*)::integer from product_keys
      where product_id = p_product_id and status = 'available'
    );
end;
$$;

revoke all on function complete_mock_key_purchase(uuid, text, text) from public;
grant execute on function complete_mock_key_purchase(uuid, text, text)
  to anon, authenticated;
