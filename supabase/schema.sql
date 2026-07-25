-- Framelink schema: run this once in Supabase Dashboard → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).

create extension if not exists "pgcrypto";

-- One row per authenticated user.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- One shop per user (a biolink storefront).
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  bio text,
  avatar_url text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists shops_owner_id_idx on shops (owner_id);

-- Digital products or bookable services listed on a shop.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  kind text not null default 'digital' check (kind in ('digital', 'booking')),
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_shop_id_idx on products (shop_id);

-- Demo orders — no real payment gateway is wired up; a "buy" click inserts
-- a row here directly so the dashboard has something real to show.
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

-- Row Level Security -----------------------------------------------------

alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

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

drop policy if exists "anyone can create a demo order" on orders;
create policy "anyone can create a demo order" on orders
  for insert with check (true);

drop policy if exists "owners can read their orders" on orders;
create policy "owners can read their orders" on orders
  for select using (
    exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
  );
