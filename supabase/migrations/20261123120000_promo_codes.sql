-- Promo codes made by shops. The discount comes off the price the buyer pays, so
-- the order, the 5% fee, any referral commission and the shop's payout all follow
-- the discounted amount. This migration NEVER moves money.
begin;

create table buykub.promo_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references buykub.shops(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'),
  -- Exactly one of: whole percent (1–100) or a fixed amount in satang.
  percent_off integer check (percent_off between 1 and 100),
  amount_off_cents integer check (amount_off_cents > 0 and amount_off_cents % 100 = 0),
  -- Empty = every product in the shop.
  product_ids uuid[] not null default '{}' check (cardinality(product_ids) <= 200),
  max_redemptions integer check (max_redemptions > 0),
  once_per_user boolean not null default false,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_cents is null)),
  unique (shop_id, code)
);

-- A code may only name products of its own shop.
create function buykub.check_promo_code_products()
returns trigger language plpgsql set search_path = pg_catalog, buykub as $$
begin
  new.code := upper(btrim(new.code));
  new.updated_at := now();
  if exists (select 1 from unnest(new.product_ids) pid
    where not exists (select 1 from buykub.products p where p.id = pid and p.shop_id = new.shop_id))
  then raise check_violation using message = 'promo_product_not_in_shop'; end if;
  return new;
end $$;
create trigger check_promo_code_products before insert or update on buykub.promo_codes
  for each row execute function buykub.check_promo_code_products();

-- Snapshot of what was applied. promo_code survives the code being deleted later.
alter table buykub.stripe_checkout_contexts
  add column promo_code_id uuid references buykub.promo_codes(id) on delete set null,
  add column promo_code text,
  add column list_price_cents integer check (list_price_cents >= 0),
  add column discount_cents integer not null default 0 check (discount_cents >= 0);
create index stripe_checkout_contexts_promo_idx on buykub.stripe_checkout_contexts(promo_code_id) where promo_code_id is not null;

-- What a code would take off this product for this buyer. A checkout that is still
-- open or already paid counts as a use; an expired or cancelled one gives it back.
-- The result is either free or at least ฿10, the PromptPay minimum.
create function buykub.promo_quote(p_product uuid, p_code text, p_user uuid)
returns table (promo_id uuid, code text, list_cents integer, discount_cents integer, final_cents integer)
language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare pr buykub.products%rowtype; c buykub.promo_codes%rowtype; d bigint;
begin
  select p.* into pr from buykub.products p join buykub.shops s on s.id = p.shop_id
  where p.id = p_product and p.published and s.published;
  if not found then raise exception 'product_not_available'; end if;
  select * into c from buykub.promo_codes pc where pc.shop_id = pr.shop_id and pc.code = upper(btrim(coalesce(p_code, '')));
  if not found or not c.active then raise exception 'promo_invalid'; end if;
  if c.expires_at is not null and c.expires_at <= now() then raise exception 'promo_expired'; end if;
  if cardinality(c.product_ids) > 0 and not (pr.id = any(c.product_ids)) then raise exception 'promo_not_for_product'; end if;
  if c.max_redemptions is not null and (select count(*) from buykub.stripe_checkout_contexts x
    where x.promo_code_id = c.id and x.status <> 'cancelled') >= c.max_redemptions then raise exception 'promo_used_up'; end if;
  if c.once_per_user and p_user is not null and exists (select 1 from buykub.stripe_checkout_contexts x
    where x.promo_code_id = c.id and x.buyer_user_id = p_user and x.status <> 'cancelled') then raise exception 'promo_already_used'; end if;
  if pr.price_cents <= 0 then raise exception 'promo_not_for_product'; end if;
  -- Whole baht off, rounded down, so the buyer still pays a whole-baht price.
  d := case when c.percent_off is not null then (pr.price_cents::bigint * c.percent_off / 10000) * 100
    else least(c.amount_off_cents, pr.price_cents) end;
  if pr.price_cents - d between 1 and 999 then raise exception 'promo_below_minimum'; end if;
  return query select c.id, c.code, pr.price_cents, d::integer, (pr.price_cents - d)::integer;
end $$;

-- For the buy button: same answer the checkout will give.
create function buykub.quote_promo_code(p_product uuid, p_code text)
returns table (code text, list_cents integer, discount_cents integer, final_cents integer)
language sql security definer set search_path = pg_catalog, buykub as $$
  select q.code, q.list_cents, q.discount_cents, q.final_cents from buykub.promo_quote(p_product, p_code, auth.uid()) q
$$;

-- Same as begin_stripe_product_checkout, then the code is applied in the same
-- transaction. Any refusal rolls back the context and any key reservation.
create function buykub.begin_product_checkout_with_promo(p_product_id uuid, p_checkout_reference uuid, p_promo_code text)
returns table (item_name text, price_cents integer)
language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare v_shop uuid; q record;
begin
  if auth.uid() is null then raise exception 'google_login_required'; end if;
  select shop_id into v_shop from buykub.products where id = p_product_id for update;
  if not found then raise exception 'product_not_available'; end if;
  -- Serialises uses of one code, so the limit holds under concurrent checkouts.
  perform 1 from buykub.promo_codes where shop_id = v_shop and code = upper(btrim(coalesce(p_promo_code, ''))) for update;
  select * into q from buykub.promo_quote(p_product_id, p_promo_code, auth.uid());
  perform buykub.begin_stripe_product_checkout(p_product_id, p_checkout_reference);
  update buykub.stripe_checkout_contexts set amount_cents = q.final_cents, list_price_cents = q.list_cents,
    discount_cents = q.discount_cents, promo_code_id = q.promo_id, promo_code = q.code
  where checkout_reference = p_checkout_reference;
  return query select p.name, q.final_cents from buykub.products p where p.id = p_product_id;
end $$;

-- Paid uses per code, for the shop's list.
create function buykub.my_promo_code_usage()
returns table (promo_id uuid, paid_uses bigint, discount_cents bigint)
language sql stable security definer set search_path = pg_catalog, buykub as $$
  select pc.id, count(x.*) filter (where x.status = 'completed'),
    coalesce(sum(x.discount_cents) filter (where x.status = 'completed'), 0)
  from buykub.promo_codes pc join buykub.shops s on s.id = pc.shop_id and s.owner_id = auth.uid()
  left join buykub.stripe_checkout_contexts x on x.promo_code_id = pc.id
  group by pc.id
$$;

-- The discount on one of the caller's shop orders, if any.
create function buykub.shop_order_discount(p_order uuid)
returns table (promo_code text, list_cents integer, discount_cents integer)
language sql stable security definer set search_path = pg_catalog, buykub as $$
  select x.promo_code, x.list_price_cents, x.discount_cents
  from buykub.orders o join buykub.shops s on s.id = o.shop_id and s.owner_id = auth.uid()
  join buykub.stripe_checkout_contexts x on x.order_id = o.id
  where o.id = p_order and x.discount_cents > 0
$$;

alter table buykub.promo_codes enable row level security;
revoke all on buykub.promo_codes from public, anon, authenticated;
grant all on buykub.promo_codes to service_role;
grant select, insert, update, delete on buykub.promo_codes to authenticated;
create policy "owners manage their promo codes" on buykub.promo_codes for all to authenticated
  using (exists (select 1 from buykub.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from buykub.shops s where s.id = shop_id and s.owner_id = auth.uid()));

revoke all on function buykub.check_promo_code_products(), buykub.promo_quote(uuid,text,uuid),
  buykub.quote_promo_code(uuid,text), buykub.begin_product_checkout_with_promo(uuid,uuid,text),
  buykub.my_promo_code_usage(), buykub.shop_order_discount(uuid) from public, anon, authenticated;
grant execute on function buykub.quote_promo_code(uuid,text) to anon, authenticated, service_role;
grant execute on function buykub.begin_product_checkout_with_promo(uuid,uuid,text), buykub.my_promo_code_usage(),
  buykub.shop_order_discount(uuid) to authenticated, service_role;
grant execute on function buykub.promo_quote(uuid,text,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
