-- Sellers arrange their products by dragging them in the shop editor.
-- position orders the dashboard and the public storefront; products that were
-- never arranged (null) follow, oldest first, so a new product lands at the end.

alter table buykub.products add column if not exists position integer check (position >= 0);
create index if not exists products_shop_position on buykub.products(shop_id, position, created_at);

-- Saves a whole arrangement at once: p_product_ids is every product of the shop
-- in its new order. A list that is not exactly the shop's products is refused,
-- so a stale tab cannot drop or misplace a product added elsewhere.
create or replace function buykub.reorder_products(p_shop_id uuid, p_product_ids uuid[])
returns void language plpgsql security definer set search_path = buykub, pg_temp as $$
begin
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid()) then
    raise exception 'not_shop_owner' using errcode = '42501';
  end if;
  perform 1 from products where shop_id = p_shop_id for update;
  if coalesce(array_length(p_product_ids, 1), 0) <> (select count(*) from products where shop_id = p_shop_id)
    or (select count(distinct id) from unnest(p_product_ids) as ids(id)) <> coalesce(array_length(p_product_ids, 1), 0)
    or exists (select 1 from unnest(p_product_ids) as ids(id) where not exists (select 1 from products p where p.id = ids.id and p.shop_id = p_shop_id))
  then
    raise exception 'product_list_changed' using errcode = '22023';
  end if;
  update products p set position = ordered.ord - 1
  from unnest(p_product_ids) with ordinality as ordered(id, ord)
  where p.id = ordered.id and p.position is distinct from ordered.ord - 1;
end $$;

revoke all on function buykub.reorder_products(uuid, uuid[]) from public, anon;
grant execute on function buykub.reorder_products(uuid, uuid[]) to authenticated;
