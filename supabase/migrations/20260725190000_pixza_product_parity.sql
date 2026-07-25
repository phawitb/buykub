alter table public.products add column if not exists slug text;
alter table public.products add column if not exists description_html text;
alter table public.products add column if not exists file_path text;
alter table public.products add column if not exists file_name text;
alter table public.products add column if not exists file_size bigint;
alter table public.products add column if not exists file_mime_type text;
alter table public.products add column if not exists images_v2 jsonb not null default '[]';
alter table public.products add column if not exists updated_at timestamptz not null default now();

update public.products
set slug = 'product-' || left(id::text, 8)
where slug is null;

create unique index if not exists products_shop_slug_unique
  on public.products (shop_id, slug)
  where slug is not null;

alter table public.orders add column if not exists buyer_name text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists mock boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method in ('promptpay', 'card'));
  end if;
end $$;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  event_type text not null check (
    event_type in ('view_product', 'click_buy', 'open_checkout', 'purchase')
  ),
  visitor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_shop_created_idx
  on public.analytics_events (shop_id, created_at desc);
create index if not exists analytics_events_product_created_idx
  on public.analytics_events (product_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "anyone can create analytics events"
  on public.analytics_events;
create policy "anyone can create analytics events"
  on public.analytics_events for insert with check (true);

drop policy if exists "owners can read analytics events"
  on public.analytics_events;
create policy "owners can read analytics events"
  on public.analytics_events for select using (
    exists (
      select 1
      from public.shops
      where shops.id = analytics_events.shop_id
        and shops.owner_id = auth.uid()
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
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
