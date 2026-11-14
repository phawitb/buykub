-- Apply after 20261112091000_checkout_amount.sql to the isolated BUYKUB schema.
-- No historical orders are enqueued and no messages are sent by this migration.
begin;
-- Payment/refund state and buyer recipients are server-authoritative. Owners
-- may read orders but cannot change status or reroute fulfillment emails.
revoke update on buykub.orders from authenticated;
drop policy if exists "owners can update their orders" on buykub.orders;
create table buykub.stripe_refund_states (
  payment_intent_id text primary key,
  amount_cents integer not null check (amount_cents >= 0),
  refunded_cents integer not null check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  observed_at timestamptz not null,
  fully_refunded boolean not null default false
);
alter table buykub.stripe_refund_states enable row level security;
create table buykub.product_email_deliveries (
  order_id uuid primary key references buykub.orders(id) on delete cascade,
  payload jsonb not null,
  first_attempt_at timestamptz not null default now(),
  lease uuid,
  lease_until timestamptz,
  provider_id text,
  sent_at timestamptz,
  last_error text
);
alter table buykub.product_email_deliveries enable row level security;
revoke all on buykub.stripe_refund_states, buykub.product_email_deliveries from public, anon, authenticated;
grant all on buykub.stripe_refund_states, buykub.product_email_deliveries to service_role;

create function buykub.sync_stripe_refund(p_payment_intent_id text,p_amount_cents integer,p_refunded_cents integer,p_observed_at timestamptz)
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
  end if;
  -- Access is never automatically restored after a full refund. A subsequent
  -- bank failure requires operator reconciliation, not reissuing a sold key.
end $$;

create function buykub.get_product_email_delivery(p_order_id uuid,p_email_token uuid)
returns jsonb language sql stable security definer set search_path=buykub as $$
  select jsonb_build_object('buyer_email',o.buyer_email,'status',o.status,
    'session_id',o.stripe_checkout_session_id,'product_name',p.name,'shop_name',s.name,'key_value',k.key_value)
  from orders o join products p on p.id=o.product_id join shops s on s.id=o.shop_id
  left join product_keys k on k.assigned_order_id=o.id and k.status='assigned'
  where o.id=p_order_id and o.fulfilment_token=p_email_token
    and o.payment_method='stripe' and o.paid_at is not null
    and o.stripe_checkout_session_id is not null and o.buyer_email is not null
    and (p.delivery_type='file' or k.key_value is not null);
$$;

create function buykub.claim_product_email(p_order_id uuid,p_email_token uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=buykub as $$
declare v_order orders%rowtype; v_delivery product_email_deliveries%rowtype; v_lease uuid := gen_random_uuid();
begin
  select * into v_order from orders where id=p_order_id and fulfilment_token=p_email_token for update;
  if not found then raise exception 'delivery_not_found'; end if;
  if v_order.status <> 'paid' then return jsonb_build_object('status','revoked'); end if;
  if v_order.payment_method <> 'stripe' or v_order.paid_at is null then raise exception 'order_not_paid'; end if;
  if v_order.fulfilment_email_status='sent' then return jsonb_build_object('status','sent'); end if;
  insert into product_email_deliveries(order_id,payload) values(p_order_id,p_payload) on conflict do nothing;
  select * into v_delivery from product_email_deliveries where order_id=p_order_id for update;
  if v_delivery.sent_at is not null then return jsonb_build_object('status','sent'); end if;
  -- Resend keeps idempotency keys for 24h. Never blindly replay an ambiguous
  -- attempt beyond that boundary; retain the payload and flag for review.
  if v_delivery.first_attempt_at < now()-interval '23 hours' then
    update orders set fulfilment_email_status='failed',fulfilment_email_last_error='Delivery requires provider reconciliation: safe retry window expired' where id=p_order_id;
    return jsonb_build_object('status','review_required');
  end if;
  if v_delivery.lease_until > now() then return jsonb_build_object('status','busy'); end if;
  update product_email_deliveries set lease=v_lease,lease_until=now()+interval '60 seconds' where order_id=p_order_id;
  update orders set fulfilment_email_status='pending',fulfilment_email_attempts=fulfilment_email_attempts+1,fulfilment_email_last_error=null where id=p_order_id;
  return jsonb_build_object('status','claimed','lease',v_lease,'payload',v_delivery.payload);
end $$;

create function buykub.finish_product_email(p_order_id uuid,p_lease uuid,p_provider_id text,p_error text)
returns void language plpgsql security definer set search_path=buykub as $$
begin
  -- Lock orders first, consistently with claim_product_email.
  perform 1 from orders where id=p_order_id for update;
  update product_email_deliveries set provider_id=p_provider_id,
    sent_at=case when p_provider_id is not null then now() else null end,
    last_error=p_error,lease=null,lease_until=null
  where order_id=p_order_id and lease=p_lease;
  if not found then raise exception 'delivery_lease_lost'; end if;
  update orders set fulfilment_email_status=case when p_provider_id is not null then 'sent' else 'failed' end,
    fulfilment_email_sent_at=case when p_provider_id is not null then now() else null end,
    fulfilment_email_last_error=p_error where id=p_order_id;
end $$;

create or replace function buykub.finalize_stripe_checkout(
  p_checkout_reference uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_buyer_email text,
  p_buyer_name text
)
returns table (kind text, order_id uuid, email_token uuid, booking_id uuid)
language plpgsql security definer set search_path = buykub
as $$
declare
  v_context stripe_checkout_contexts%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_product products%rowtype;
  v_refunded boolean := false;
begin
  if p_stripe_payment_intent_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_stripe_payment_intent_id,0));
    select fully_refunded into v_refunded
    from stripe_refund_states where payment_intent_id=p_stripe_payment_intent_id;
    v_refunded := coalesce(v_refunded,false);
  end if;
  select * into v_context from stripe_checkout_contexts
  where checkout_reference = p_checkout_reference and stripe_session_id = p_stripe_session_id
  for update;
  if not found then raise exception 'checkout_not_found'; end if;
  if v_context.status = 'completed' then
    return query select v_context.kind, v_context.order_id,
      (select o.fulfilment_token from orders o where o.id=v_context.order_id and o.status='paid' and o.fulfilment_email_status is distinct from 'sent'),
      (select b.id from bookings b where b.id=v_context.booking_id and b.status='confirmed' and not v_refunded);
    return;
  end if;
  if v_context.status <> 'created' then raise exception 'checkout_not_active'; end if;

  if v_context.kind = 'product' then
    select * into v_product from products where id = v_context.product_id;
    insert into orders(id, shop_id, product_id, buyer_name, buyer_email, payment_method, price_cents, status, mock, fulfilment_email_status, fulfilment_token, stripe_checkout_session_id, stripe_payment_intent_id, paid_at)
    values (v_order_id, v_context.shop_id, v_context.product_id, nullif(btrim(coalesce(p_buyer_name, '')), ''), lower(btrim(p_buyer_email)), 'stripe', v_context.amount_cents, case when v_refunded then 'refunded' else 'paid' end, false,
      case when not v_refunded then 'pending' else null end, v_token,
      p_stripe_session_id, p_stripe_payment_intent_id, now());
    update product_keys set status = 'assigned', stripe_checkout_reference = null,
      assigned_order_id = v_order_id, assigned_at = now(), updated_at = now()
    where stripe_checkout_reference = p_checkout_reference and status = 'reserved';
    update stripe_checkout_contexts set status = 'completed', order_id = v_order_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id, completed_at = now()
    where checkout_reference = p_checkout_reference;
    return query select 'product'::text, v_order_id,
      case when not v_refunded then v_token else null end, null::uuid;
  else
    update bookings set status = case when v_refunded then 'cancelled' else 'confirmed' end, buyer_name = nullif(btrim(coalesce(p_buyer_name, '')), ''),
      buyer_email = lower(btrim(p_buyer_email)), stripe_payment_intent_id = p_stripe_payment_intent_id,
      paid_at = now() where id = v_context.booking_id;
    update stripe_checkout_contexts set status = 'completed', stripe_payment_intent_id = p_stripe_payment_intent_id,
      completed_at = now() where checkout_reference = p_checkout_reference;
    return query select 'service'::text, null::uuid, null::uuid,
      case when not v_refunded then v_context.booking_id else null end;
  end if;
end;
$$;

create or replace function buykub.get_stripe_checkout_success(p_stripe_session_id text)
returns table(kind text,status text,item_name text,order_id uuid,assigned_key text,email_status text,booking_id uuid,booking_status text,meet_url text)
language sql stable security definer set search_path=buykub as $$
  select c.kind,
    case when o.status='refunded' or (c.kind='service' and r.fully_refunded) then 'refunded' else c.status end,
    coalesce(p.name,s.name),o.id,case when o.status='paid' then k.key_value else null end,o.fulfilment_email_status,
    b.id,b.status,case when b.status='confirmed' then b.google_meet_url else null end
  from stripe_checkout_contexts c
  left join products p on p.id=c.product_id left join services s on s.id=c.service_id
  left join orders o on o.id=c.order_id left join product_keys k on k.assigned_order_id=o.id and k.status='assigned'
  left join bookings b on b.id=c.booking_id left join stripe_refund_states r on r.payment_intent_id=c.stripe_payment_intent_id
  where c.stripe_session_id=p_stripe_session_id;
$$;
revoke all on function buykub.sync_stripe_refund(text,integer,integer,timestamptz), buykub.get_product_email_delivery(uuid,uuid),buykub.claim_product_email(uuid,uuid,jsonb),buykub.finish_product_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function buykub.sync_stripe_refund(text,integer,integer,timestamptz),buykub.get_product_email_delivery(uuid,uuid),buykub.claim_product_email(uuid,uuid,jsonb),buykub.finish_product_email(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
