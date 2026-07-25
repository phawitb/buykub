drop policy if exists "owners can update their orders" on public.orders;
create policy "owners can update their orders" on public.orders
  for update using (
    exists (
      select 1 from public.shops
      where shops.id = orders.shop_id
        and shops.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.shops
      where shops.id = orders.shop_id
        and shops.owner_id = auth.uid()
    )
  );
