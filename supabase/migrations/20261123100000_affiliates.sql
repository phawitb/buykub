-- Referral links paid by the shop. Only an earlier buyer of a product can refer it,
-- the buyer pays the normal price, and the commission is withheld from the shop's
-- payout. Affiliate payouts are manual bank transfers. This migration NEVER moves money.
begin;

-- null = referrals off. Rate in basis points: 100 = 1%, 5000 = 50%.
alter table buykub.products add column affiliate_rate_bp integer check (affiliate_rate_bp between 100 and 5000);

create table buykub.affiliate_links (
  code text primary key check (code ~ '^[a-z0-9]{10}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references buykub.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table buykub.stripe_checkout_contexts
  add column affiliate_user_id uuid references auth.users(id),
  add column affiliate_rate_bp integer check (affiliate_rate_bp between 100 and 5000);

create table buykub.affiliate_payout_batches (
  id uuid primary key default gen_random_uuid(), request_key text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ready' check (status in ('ready','completed','cancelled')),
  amount_cents bigint not null check (amount_cents > 0),
  recipient_snapshot jsonb not null, profile_fingerprint text not null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  completion_review_required boolean not null default false,
  completed_by uuid references auth.users(id), paid_at timestamptz, transfer_reference text unique,
  check ((status = 'completed') = (paid_at is not null and transfer_reference is not null))
);

-- pending: order paid, shop not yet paid out. payable: the shop's payout withheld it.
-- paid: transferred to the affiliate. void: refunded before it was transferred.
create table buykub.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references buykub.orders(id) on delete restrict,
  affiliate_user_id uuid not null references auth.users(id) on delete restrict,
  shop_id uuid not null references buykub.shops(id) on delete restrict,
  product_id uuid not null references buykub.products(id) on delete restrict,
  rate_bp integer not null check (rate_bp between 100 and 5000),
  gross_cents bigint not null check (gross_cents > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','payable','paid','void')),
  seller_batch_id uuid references buykub.seller_payout_batches(id),
  batch_id uuid references buykub.affiliate_payout_batches(id),
  created_at timestamptz not null default now(), payable_at timestamptz, voided_at timestamptz
);
create index affiliate_commissions_affiliate on buykub.affiliate_commissions(affiliate_user_id, status);
create index affiliate_commissions_shop on buykub.affiliate_commissions(shop_id);

-- Withheld from the shop when its payout is prepared, so the transfer amount is exact.
alter table buykub.seller_payout_allocations add column affiliate_cents bigint not null default 0 check (affiliate_cents >= 0);
alter table buykub.seller_payout_allocations add constraint seller_payout_allocation_after_affiliate check (net_cents > affiliate_cents);

create table buykub.affiliate_payout_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payout_method text not null default 'promptpay' check (payout_method in ('promptpay','bank')),
  promptpay_id text, bank_details text, full_name_th text, contact_phone text, national_id text,
  address_line text, subdistrict text, district text, province text, postal_code text,
  updated_at timestamptz not null default now(),
  constraint affiliate_payout_profile_complete check (
    full_name_th is not null and buykub.valid_payout_thai_name(full_name_th)
    and contact_phone is not null and contact_phone ~ '^0[0-9]{9}$'
    and national_id is not null and buykub.valid_thai_national_id(national_id)
    and address_line is not null and char_length(address_line) between 1 and 500 and address_line ~ '[^[:space:]]'
    and subdistrict is not null and char_length(subdistrict) between 1 and 100 and subdistrict ~ '[^[:space:]]'
    and district is not null and char_length(district) between 1 and 100 and district ~ '[^[:space:]]'
    and province is not null and char_length(province) between 1 and 100 and province ~ '[^[:space:]]'
    and postal_code is not null and postal_code ~ '^[0-9]{5}$'
    and ((payout_method = 'promptpay' and promptpay_id ~ '^([0-9]{10}|[0-9]{13})$' and bank_details is null)
      or (payout_method = 'bank' and buykub.valid_payout_bank_details(bank_details) and promptpay_id is null
        and buykub.payout_bank_name_matches(full_name_th, bank_details)))
  )
);

create table buykub.affiliate_payout_events (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
  batch_id uuid references buykub.affiliate_payout_batches(id), action text not null,
  created_at timestamptz not null default now()
);
create table buykub.affiliate_payout_slips (
  batch_id uuid primary key references buykub.affiliate_payout_batches(id),
  object_path text not null unique, mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid references auth.users(id), uploaded_at timestamptz not null default now()
);

-- An earlier buyer of the product whose order is still paid.
create function buykub.affiliate_eligible(p_user uuid, p_product uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, buykub as $$
  select exists (select 1 from buykub.orders o where o.buyer_user_id = p_user and o.product_id = p_product
    and o.status = 'paid' and not o.mock)
$$;

-- The caller's link for a product, created on first use.
create function buykub.get_affiliate_link(p_product uuid)
returns text language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (select 1 from buykub.products p join buykub.shops s on s.id = p.shop_id
    where p.id = p_product and p.published and s.published and p.affiliate_rate_bp is not null) then raise exception 'affiliate_disabled'; end if;
  if not buykub.affiliate_eligible(auth.uid(), p_product) then raise exception 'affiliate_not_eligible'; end if;
  select code into v_code from buykub.affiliate_links where user_id = auth.uid() and product_id = p_product;
  if found then return v_code; end if;
  loop
    v_code := substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10);
    begin
      insert into buykub.affiliate_links(code, user_id, product_id) values (v_code, auth.uid(), p_product);
      return v_code;
    exception when unique_violation then
      select code into v_code from buykub.affiliate_links where user_id = auth.uid() and product_id = p_product;
      if found then return v_code; end if;
    end;
  end loop;
end $$;

-- Public: where a link leads. Reveals nothing about who shared it.
create function buykub.resolve_affiliate_code(p_code text)
returns table (shop_slug text, product_slug text) language sql stable security definer set search_path = pg_catalog, buykub as $$
  select s.slug, p.slug from buykub.affiliate_links l
  join buykub.products p on p.id = l.product_id join buykub.shops s on s.id = p.shop_id
  where l.code = lower(btrim(p_code)) and p.published and s.published
$$;

-- Called by the buyer right after begin_stripe_product_checkout. A code that does
-- not qualify is ignored, so a bad link never blocks a purchase.
create function buykub.attach_checkout_referral(p_checkout_reference uuid, p_code text)
returns void language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare c buykub.stripe_checkout_contexts%rowtype; l buykub.affiliate_links%rowtype; v_rate integer; v_owner uuid;
begin
  if auth.uid() is null or p_code is null then return; end if;
  select * into c from buykub.stripe_checkout_contexts where checkout_reference = p_checkout_reference for update;
  if not found or c.buyer_user_id is distinct from auth.uid() or c.status <> 'created' or c.kind <> 'product'
    or c.stripe_session_id is not null or c.affiliate_user_id is not null or c.amount_cents <= 0 then return; end if;
  select * into l from buykub.affiliate_links where code = lower(btrim(p_code));
  if not found or l.product_id <> c.product_id or l.user_id = auth.uid() then return; end if;
  select p.affiliate_rate_bp, s.owner_id into v_rate, v_owner from buykub.products p join buykub.shops s on s.id = p.shop_id where p.id = c.product_id;
  if v_rate is null or l.user_id = v_owner or not buykub.affiliate_eligible(l.user_id, c.product_id) then return; end if;
  update buykub.stripe_checkout_contexts set affiliate_user_id = l.user_id, affiliate_rate_bp = v_rate
  where checkout_reference = p_checkout_reference;
end $$;

-- Orders are only inserted by finalize_stripe_checkout; the context carries the referral.
create function buykub.record_affiliate_commission()
returns trigger language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare c buykub.stripe_checkout_contexts%rowtype;
begin
  if new.stripe_checkout_session_id is null or new.status <> 'paid' or new.mock or new.price_cents <= 0 then return null; end if;
  select * into c from buykub.stripe_checkout_contexts where stripe_session_id = new.stripe_checkout_session_id and product_id = new.product_id;
  if not found or c.affiliate_user_id is null or c.affiliate_user_id is not distinct from new.buyer_user_id
    or (new.price_cents::bigint * c.affiliate_rate_bp) / 10000 = 0 then return null; end if;
  insert into buykub.affiliate_commissions(order_id, affiliate_user_id, shop_id, product_id, rate_bp, gross_cents, amount_cents)
  values (new.id, c.affiliate_user_id, new.shop_id, new.product_id, c.affiliate_rate_bp, new.price_cents,
    (new.price_cents::bigint * c.affiliate_rate_bp) / 10000);
  return null;
end $$;
create trigger record_affiliate_commission after insert on buykub.orders for each row execute function buykub.record_affiliate_commission();

-- Same as 20261112092000, plus: a full refund voids any commission not yet transferred.
create or replace function buykub.sync_stripe_refund(p_payment_intent_id text,p_amount_cents integer,p_refunded_cents integer,p_observed_at timestamptz)
returns void language plpgsql security definer set search_path=buykub as $$
declare v_state stripe_refund_states%rowtype;
begin
  if p_payment_intent_id is null or p_payment_intent_id !~ '^pi_' then raise exception 'invalid_payment_intent'; end if;
  -- Shared lock order with fulfillment prevents refund-before-fulfillment races.
  perform pg_advisory_xact_lock(hashtextextended(p_payment_intent_id,0));
  insert into stripe_refund_states values(p_payment_intent_id,p_amount_cents,p_refunded_cents,p_observed_at,p_amount_cents>0 and p_refunded_cents>=p_amount_cents)
  on conflict(payment_intent_id) do update set amount_cents=excluded.amount_cents,
    refunded_cents=excluded.refunded_cents,observed_at=excluded.observed_at,
    fully_refunded=stripe_refund_states.fully_refunded or excluded.fully_refunded
  where stripe_refund_states.observed_at < excluded.observed_at;
  select * into v_state from stripe_refund_states where payment_intent_id=p_payment_intent_id;
  if v_state.fully_refunded then
    update orders set status='refunded' where stripe_payment_intent_id=p_payment_intent_id and status='paid';
    update bookings set status='cancelled' where stripe_payment_intent_id=p_payment_intent_id and status='confirmed';
    update affiliate_commissions set status='void',voided_at=now()
    where status in ('pending','payable') and order_id in (select id from orders where stripe_payment_intent_id=p_payment_intent_id);
  end if;
  -- Access is never automatically restored after a full refund. A subsequent
  -- bank failure requires operator reconciliation, not reissuing a sold key.
end $$;

-- Commission on what the shop actually kept, for a still-pending referral.
create function buykub.affiliate_withholding(p_order uuid, p_gross bigint, p_refunded bigint)
returns bigint language sql stable set search_path = pg_catalog, buykub as $$
  select coalesce((select (c.rate_bp::bigint * (p_gross - p_refunded)) / 10000 from buykub.affiliate_commissions c
    where c.order_id = p_order and c.status = 'pending'), 0)
$$;

-- Same as 20261114111000, but the shop's amount is net of affiliate commission.
create or replace function buykub.prepare_seller_payout_batch(p_actor uuid,p_request text,p_shop uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,buykub as $$
declare b uuid; p buykub.seller_payout_profiles%rowtype; total bigint; snapshot jsonb; owner uuid;
begin
 if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
 if p_request is null or char_length(p_request) not between 1 and 150 then raise check_violation using message='invalid_request_key'; end if;
 perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
 select id into b from buykub.seller_payout_batches where request_key=p_request||':'||p_shop::text;
 if found then return b; end if;
 select owner_id into owner from buykub.shops where id=p_shop for update;
 if owner is null then raise check_violation using message='shop_missing'; end if;
 if exists(select 1 from buykub.admin_user_controls where user_id=owner and payout_hold) then raise check_violation using message='seller_payout_hold'; end if;
 if buykub.seller_payout_shop_requires_review(p_shop) then raise check_violation using message='previous_payout_requires_review'; end if;
 select * into p from buykub.seller_payout_profiles where shop_id=p_shop for update;
 if not found or not buykub.seller_payout_profile_valid(p) then raise check_violation using message='payout_profile_incomplete_or_name_mismatch'; end if;
 -- Lock orders before allocation. Re-check current database status, not an old UI snapshot.
 perform 1 from buykub.orders where shop_id=p_shop order by id for update;
 perform 1 from buykub.seller_payout_observations v join buykub.orders o on o.id=v.order_id where o.shop_id=p_shop order by v.order_id for update of v;
 perform 1 from buykub.affiliate_commissions where shop_id=p_shop order by id for update;
 create temp table seller_payout_candidates on commit drop as
 select o.id order_id,v.payment_intent_id,v.charge_id,v.gross_cents,v.refunded_cents,v.net_cents,
 buykub.affiliate_withholding(o.id,v.gross_cents,v.refunded_cents) affiliate_cents
 from buykub.seller_payout_observations v join buykub.orders o on o.id=v.order_id
 where o.shop_id=p_shop and o.status='paid' and not o.mock and o.payment_method='stripe' and o.price_cents>0
 and o.paid_at<=now()-interval '7 days' and o.stripe_payment_intent_id=v.payment_intent_id
 and o.price_cents=v.gross_cents and v.eligible and v.checked_at>=now()-interval '5 minutes'
 and v.net_cents=(v.gross_cents-v.refunded_cents)-floor(((v.gross_cents-v.refunded_cents)*5+50)::numeric/100)
 and not exists(select 1 from buykub.seller_payout_allocations a where a.order_id=o.id and a.released_at is null);
 select sum(net_cents-affiliate_cents) into total from seller_payout_candidates;
 if total is null or total<=0 then drop table seller_payout_candidates; return null; end if;
 snapshot:=jsonb_build_object('recipientName',p.full_name_th,'method',p.payout_method,
 'bankCode',case when p.payout_method='bank' then p.bank_details::jsonb->>'bankCode' end,
 'accountNumber',case when p.payout_method='bank' then p.bank_details::jsonb->>'accountNumber' end,
 'promptpayId',p.promptpay_id);
 insert into buykub.seller_payout_batches(request_key,shop_id,amount_cents,recipient_snapshot,profile_fingerprint,created_by)
 values(p_request||':'||p_shop::text,p_shop,total,snapshot,md5(to_jsonb(p)::text),p_actor) returning id into b;
 insert into buykub.seller_payout_allocations(batch_id,order_id,payment_intent_id,charge_id,gross_cents,refunded_cents,net_cents,affiliate_cents)
 select b,order_id,payment_intent_id,charge_id,gross_cents,refunded_cents,net_cents,affiliate_cents from seller_payout_candidates;
 drop table seller_payout_candidates;
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,b,'prepared_for_manual_transfer');
 return b;
end $$;

-- Same as 20261114111000, plus: the commissions withheld by this transfer become payable.
create or replace function buykub.complete_manual_seller_payout(p_actor uuid,p_batch uuid,p_reference text,p_paid_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,buykub as $$
declare b buykub.seller_payout_batches%rowtype; p buykub.seller_payout_profiles%rowtype; owner uuid; needs_review boolean:=false;
begin
 if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
 perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
 select * into b from buykub.seller_payout_batches where id=p_batch for update;
 if not found then raise check_violation using message='batch_missing'; end if;
 if b.status='completed' and b.transfer_reference=upper(btrim(p_reference)) then return; end if;
 if b.status not in ('ready','review_required') then raise check_violation using message='batch_not_ready'; end if;
 needs_review:=b.status='review_required';
 if not exists(select 1 from buykub.seller_payout_slips where batch_id=p_batch) then raise check_violation using message='payout_slip_required'; end if;
 if p_reference is null or char_length(btrim(p_reference)) not between 6 and 150 or p_paid_at is null or p_paid_at>now()+interval '5 minutes' or p_paid_at<date_trunc('minute',b.created_at) then raise check_violation using message='invalid_real_bank_reference_or_date'; end if;
 select owner_id into owner from buykub.shops where id=b.shop_id for update;
 if exists(select 1 from buykub.admin_user_controls where user_id=owner and payout_hold) then needs_review:=true; end if;
 select * into p from buykub.seller_payout_profiles where shop_id=b.shop_id for update;
 if not found or not buykub.seller_payout_profile_valid(p) or md5(to_jsonb(p)::text)<>b.profile_fingerprint then needs_review:=true; end if;
 if buykub.seller_payout_shop_requires_review(b.shop_id) then needs_review:=true; end if;
 perform 1 from buykub.orders o join buykub.seller_payout_allocations a on a.order_id=o.id where a.batch_id=b.id order by o.id for update of o;
 if exists(select 1 from buykub.seller_payout_allocations a join buykub.orders o on o.id=a.order_id
 left join buykub.seller_payout_observations v on v.order_id=a.order_id where a.batch_id=b.id
 and (a.released_at is not null or o.status<>'paid' or o.mock or o.payment_method<>'stripe' or o.price_cents<>a.gross_cents
 or o.stripe_payment_intent_id is distinct from a.payment_intent_id or v.order_id is null or not v.eligible
 or v.checked_at<now()-interval '5 minutes' or v.net_cents<>a.net_cents or v.refunded_cents<>a.refunded_cents
 or v.charge_id is distinct from a.charge_id or v.payment_intent_id is distinct from a.payment_intent_id))
 then needs_review:=true; end if;
 update buykub.seller_payout_batches set status='completed',completion_review_required=needs_review,completed_by=p_actor,paid_at=p_paid_at,transfer_reference=upper(btrim(p_reference)) where id=p_batch;
 update buykub.affiliate_commissions c set status='payable',amount_cents=a.affiliate_cents,seller_batch_id=b.id,payable_at=now()
 from buykub.seller_payout_allocations a where a.batch_id=b.id and a.released_at is null and c.order_id=a.order_id and c.status='pending';
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,p_batch,case when needs_review then 'manual_transfer_attested_requires_review' else 'manual_transfer_attested' end);
end $$;

create function buykub.affiliate_payout_profile_valid(p buykub.affiliate_payout_profiles)
returns boolean language sql stable set search_path = pg_catalog, buykub as $$
  select coalesce(buykub.valid_payout_thai_name(p.full_name_th)
    and p.contact_phone ~ '^0[0-9]{9}$' and buykub.valid_thai_national_id(p.national_id)
    and char_length(btrim(p.address_line)) between 1 and 500
    and char_length(btrim(p.subdistrict)) between 1 and 100 and char_length(btrim(p.district)) between 1 and 100
    and char_length(btrim(p.province)) between 1 and 100 and p.postal_code ~ '^[0-9]{5}$'
    and case when p.payout_method = 'promptpay' then p.promptpay_id ~ '^([0-9]{10}|[0-9]{13})$' and p.bank_details is null
      when p.payout_method = 'bank' then buykub.valid_payout_bank_details(p.bank_details) and p.promptpay_id is null
        and buykub.payout_bank_name_matches(p.full_name_th, p.bank_details)
      else false end, false)
$$;

-- One manual transfer covering every payable commission of one affiliate.
create function buykub.prepare_affiliate_payout_batch(p_actor uuid, p_request text, p_user uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare b uuid; p buykub.affiliate_payout_profiles%rowtype; total bigint;
begin
  if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
  if p_request is null or char_length(p_request) not between 1 and 150 then raise check_violation using message='invalid_request_key'; end if;
  perform pg_advisory_xact_lock(hashtextextended('affiliate-payout-ledger', 0));
  select id into b from buykub.affiliate_payout_batches where request_key = p_request || ':' || p_user::text;
  if found then return b; end if;
  if exists (select 1 from buykub.admin_user_controls where user_id = p_user and payout_hold) then raise check_violation using message='affiliate_payout_hold'; end if;
  select * into p from buykub.affiliate_payout_profiles where user_id = p_user for update;
  if not found or not buykub.affiliate_payout_profile_valid(p) then raise check_violation using message='payout_profile_incomplete_or_name_mismatch'; end if;
  perform 1 from buykub.affiliate_commissions where affiliate_user_id = p_user order by id for update;
  select sum(c.amount_cents) into total from buykub.affiliate_commissions c join buykub.orders o on o.id = c.order_id
  where c.affiliate_user_id = p_user and c.status = 'payable' and c.batch_id is null and c.amount_cents > 0 and o.status = 'paid';
  if total is null or total <= 0 then return null; end if;
  insert into buykub.affiliate_payout_batches(request_key, user_id, amount_cents, recipient_snapshot, profile_fingerprint, created_by)
  values (p_request || ':' || p_user::text, p_user, total,
    jsonb_build_object('recipientName', p.full_name_th, 'method', p.payout_method,
      'bankCode', case when p.payout_method = 'bank' then p.bank_details::jsonb->>'bankCode' end,
      'accountNumber', case when p.payout_method = 'bank' then p.bank_details::jsonb->>'accountNumber' end,
      'promptpayId', p.promptpay_id),
    md5(to_jsonb(p)::text), p_actor) returning id into b;
  update buykub.affiliate_commissions c set batch_id = b from buykub.orders o
  where o.id = c.order_id and c.affiliate_user_id = p_user and c.status = 'payable' and c.batch_id is null and c.amount_cents > 0 and o.status = 'paid';
  insert into buykub.affiliate_payout_events(actor_id, batch_id, action) values (p_actor, b, 'prepared_for_manual_transfer');
  return b;
end $$;

create function buykub.attach_affiliate_payout_slip(p_actor uuid, p_batch uuid, p_path text, p_mime text, p_size integer)
returns text language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare b buykub.affiliate_payout_batches%rowtype; previous text;
begin
  perform buykub.assert_platform_admin(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('affiliate-payout-ledger', 0));
  select * into b from buykub.affiliate_payout_batches where id = p_batch for update;
  if not found or b.status = 'cancelled' then raise check_violation using message='batch_not_available'; end if;
  select object_path into previous from buykub.affiliate_payout_slips where batch_id = p_batch;
  if previous is not null and b.status = 'completed' then raise check_violation using message='completed_slip_immutable'; end if;
  if p_path !~ ('^affiliate/' || p_batch::text || '/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$') then raise check_violation using message='invalid_slip_path'; end if;
  insert into buykub.affiliate_payout_slips(batch_id, object_path, mime_type, size_bytes, uploaded_by)
  values (p_batch, p_path, p_mime, p_size, p_actor)
  on conflict (batch_id) do update set object_path = excluded.object_path, mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes, uploaded_by = excluded.uploaded_by, uploaded_at = now();
  insert into buykub.affiliate_payout_events(actor_id, batch_id, action) values (p_actor, p_batch, case when previous is null then 'slip_attached' else 'slip_replaced' end);
  return previous;
end $$;

create function buykub.cancel_affiliate_payout_batch(p_actor uuid, p_batch uuid)
returns void language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare b buykub.affiliate_payout_batches%rowtype;
begin
  if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
  perform pg_advisory_xact_lock(hashtextextended('affiliate-payout-ledger', 0));
  select * into b from buykub.affiliate_payout_batches where id = p_batch for update;
  if not found then raise check_violation using message='batch_missing'; end if;
  if b.status = 'cancelled' then return; end if;
  if b.status <> 'ready' then raise check_violation using message='cannot_cancel_completed_payout'; end if;
  if exists (select 1 from buykub.affiliate_payout_slips where batch_id = p_batch) then raise check_violation using message='slip_attached_possible_transfer_do_not_cancel'; end if;
  update buykub.affiliate_commissions set batch_id = null where batch_id = p_batch and status <> 'paid';
  update buykub.affiliate_payout_batches set status = 'cancelled' where id = p_batch;
  insert into buykub.affiliate_payout_events(actor_id, batch_id, action) values (p_actor, p_batch, 'cancelled');
end $$;

create function buykub.complete_manual_affiliate_payout(p_actor uuid, p_batch uuid, p_reference text, p_paid_at timestamptz)
returns void language plpgsql security definer set search_path = pg_catalog, buykub as $$
declare b buykub.affiliate_payout_batches%rowtype; p buykub.affiliate_payout_profiles%rowtype; needs_review boolean := false;
begin
  if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
  perform pg_advisory_xact_lock(hashtextextended('affiliate-payout-ledger', 0));
  select * into b from buykub.affiliate_payout_batches where id = p_batch for update;
  if not found then raise check_violation using message='batch_missing'; end if;
  if b.status = 'completed' and b.transfer_reference = upper(btrim(p_reference)) then return; end if;
  if b.status <> 'ready' then raise check_violation using message='batch_not_ready'; end if;
  if not exists (select 1 from buykub.affiliate_payout_slips where batch_id = p_batch) then raise check_violation using message='payout_slip_required'; end if;
  if p_reference is null or char_length(btrim(p_reference)) not between 6 and 150 or p_paid_at is null
    or p_paid_at > now() + interval '5 minutes' or p_paid_at < date_trunc('minute', b.created_at) then raise check_violation using message='invalid_real_bank_reference_or_date'; end if;
  if exists (select 1 from buykub.admin_user_controls where user_id = b.user_id and payout_hold) then needs_review := true; end if;
  select * into p from buykub.affiliate_payout_profiles where user_id = b.user_id for update;
  if not found or not buykub.affiliate_payout_profile_valid(p) or md5(to_jsonb(p)::text) <> b.profile_fingerprint then needs_review := true; end if;
  -- A refund after preparing voids the commission; record the real transfer but flag it.
  if exists (select 1 from buykub.affiliate_commissions where batch_id = p_batch and status <> 'payable') then needs_review := true; end if;
  update buykub.affiliate_commissions set status = 'paid' where batch_id = p_batch and status = 'payable';
  update buykub.affiliate_payout_batches set status = 'completed', completion_review_required = needs_review, completed_by = p_actor,
    paid_at = p_paid_at, transfer_reference = upper(btrim(p_reference)) where id = p_batch;
  insert into buykub.affiliate_payout_events(actor_id, batch_id, action) values (p_actor, p_batch,
    case when needs_review then 'manual_transfer_attested_requires_review' else 'manual_transfer_attested' end);
end $$;

create function buykub.audit_affiliate_payout_event()
returns trigger language plpgsql security definer set search_path = pg_catalog, buykub as $$
begin
  if new.actor_id is not null then insert into buykub.admin_audit_log(actor_id, action, target_id, metadata)
    values (new.actor_id, 'affiliate_payout.' || new.action, new.batch_id, '{}'::jsonb); end if;
  return new;
end $$;
create trigger audit_affiliate_payout_event after insert on buykub.affiliate_payout_events for each row execute function buykub.audit_affiliate_payout_event();

-- The caller's commissions, without anything about the buyers.
create function buykub.my_affiliate_commissions()
returns table (product_id uuid, product_name text, created_at timestamptz, rate_bp integer, amount_cents bigint, status text)
language sql stable security definer set search_path = pg_catalog, buykub as $$
  select c.product_id, p.name, c.created_at, c.rate_bp, c.amount_cents, c.status
  from buykub.affiliate_commissions c join buykub.products p on p.id = c.product_id
  where c.affiliate_user_id = auth.uid() order by c.created_at desc limit 500
$$;

-- Ledger tables: service role only, except the read policies below.
do $$ declare n text; begin
  foreach n in array array['affiliate_links','affiliate_commissions','affiliate_payout_batches','affiliate_payout_events','affiliate_payout_slips','affiliate_payout_profiles'] loop
    execute format('alter table buykub.%I enable row level security', n);
    execute format('alter table buykub.%I force row level security', n);
    execute format('revoke all on buykub.%I from public, anon, authenticated', n);
    execute format('grant all on buykub.%I to service_role', n);
  end loop;
end $$;
grant usage, select on sequence buykub.affiliate_payout_events_id_seq to service_role;

grant select on buykub.affiliate_links to authenticated;
create policy "users read their links" on buykub.affiliate_links for select to authenticated using (user_id = auth.uid());
-- Shops see what each order withholds; the affiliate stays anonymous to them.
grant select (id, order_id, shop_id, product_id, rate_bp, gross_cents, amount_cents, status, created_at) on buykub.affiliate_commissions to authenticated;
create policy "owners read commissions on their orders" on buykub.affiliate_commissions for select to authenticated
  using (exists (select 1 from buykub.shops s where s.id = shop_id and s.owner_id = auth.uid()));
grant select, insert, update on buykub.affiliate_payout_profiles to authenticated;
create policy "users read their payout profile" on buykub.affiliate_payout_profiles for select to authenticated using (user_id = auth.uid());
create policy "users add their payout profile" on buykub.affiliate_payout_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users update their payout profile" on buykub.affiliate_payout_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on function buykub.affiliate_eligible(uuid,uuid), buykub.get_affiliate_link(uuid), buykub.resolve_affiliate_code(text),
  buykub.attach_checkout_referral(uuid,text), buykub.record_affiliate_commission(), buykub.affiliate_withholding(uuid,bigint,bigint),
  buykub.affiliate_payout_profile_valid(buykub.affiliate_payout_profiles), buykub.prepare_affiliate_payout_batch(uuid,text,uuid),
  buykub.attach_affiliate_payout_slip(uuid,uuid,text,text,integer), buykub.cancel_affiliate_payout_batch(uuid,uuid),
  buykub.complete_manual_affiliate_payout(uuid,uuid,text,timestamptz), buykub.audit_affiliate_payout_event(),
  buykub.my_affiliate_commissions() from public, anon, authenticated;
grant execute on function buykub.resolve_affiliate_code(text) to anon, authenticated, service_role;
grant execute on function buykub.get_affiliate_link(uuid), buykub.attach_checkout_referral(uuid,text), buykub.my_affiliate_commissions() to authenticated, service_role;
grant execute on function buykub.affiliate_eligible(uuid,uuid), buykub.affiliate_withholding(uuid,bigint,bigint),
  buykub.affiliate_payout_profile_valid(buykub.affiliate_payout_profiles), buykub.prepare_affiliate_payout_batch(uuid,text,uuid),
  buykub.attach_affiliate_payout_slip(uuid,uuid,text,text,integer), buykub.cancel_affiliate_payout_batch(uuid,uuid),
  buykub.complete_manual_affiliate_payout(uuid,uuid,text,timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
