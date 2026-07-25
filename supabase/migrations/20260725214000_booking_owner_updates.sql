drop policy if exists "owners can update their bookings" on public.bookings;
create policy "owners can update their bookings" on public.bookings
  for update using (
    exists (
      select 1 from public.shops
      where shops.id = bookings.shop_id
        and shops.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.shops
      where shops.id = bookings.shop_id
        and shops.owner_id = auth.uid()
    )
  );
