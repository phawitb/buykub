-- USING checks the existing key. WITH CHECK must also authorize the new
-- product_id, otherwise an owner can transfer inventory into another shop.
-- Preserve the existing update eligibility and fulfillment restrictions.
begin;

alter policy "owners can update unassigned product keys"
  on buykub.product_keys
  with check (
    status in ('available', 'disabled')
    and assigned_order_id is null
    and assigned_at is null
    and exists (
      select 1
      from buykub.products
      join buykub.shops on shops.id = products.shop_id
      where products.id = product_keys.product_id
        and shops.owner_id = auth.uid()
    )
  );

commit;
