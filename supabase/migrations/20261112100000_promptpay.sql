-- Native PromptPay: the receipt is an opaque pp_ capability, not a Stripe Session.
begin;
alter table buykub.stripe_checkout_contexts
  add column promptpay_buyer_email text,
  add column promptpay_expires_at timestamptz;
create unique index stripe_checkout_contexts_payment_intent_unique on buykub.stripe_checkout_contexts(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Browsers must never release a key while its QR can still be paid.
revoke all on function buykub.attach_stripe_checkout_session(uuid,text),buykub.cancel_stripe_checkout(uuid) from public,anon,authenticated;
grant execute on function buykub.attach_stripe_checkout_session(uuid,text),buykub.cancel_stripe_checkout(uuid) to service_role;

create function buykub.prepare_promptpay_checkout(p_checkout_reference uuid,p_email text)
returns void language plpgsql security definer set search_path=buykub as $$
begin
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  update stripe_checkout_contexts set stripe_session_id='pp_'||gen_random_uuid()::text,
    promptpay_buyer_email=lower(btrim(p_email)),promptpay_expires_at=now()+interval '1 hour'
  where checkout_reference=p_checkout_reference and status='created' and stripe_session_id is null;
  if not found and not exists(select 1 from stripe_checkout_contexts where checkout_reference=p_checkout_reference and promptpay_buyer_email=lower(btrim(p_email))) then raise exception 'checkout_not_available'; end if;
end $$;
create function buykub.attach_promptpay_intent(p_checkout_reference uuid,p_payment_intent_id text)
returns void language plpgsql security definer set search_path=buykub as $$
begin
  if p_payment_intent_id !~ '^pi_' then raise exception 'invalid_payment_intent'; end if;
  update stripe_checkout_contexts set stripe_payment_intent_id=p_payment_intent_id
  where checkout_reference=p_checkout_reference and status='created' and promptpay_buyer_email is not null
    and (stripe_payment_intent_id is null or stripe_payment_intent_id=p_payment_intent_id);
  if not found then raise exception 'checkout_not_available'; end if;
end $$;
create function buykub.finalize_promptpay_checkout(p_checkout_reference uuid,p_payment_intent_id text,p_amount_cents integer,p_currency text)
returns table(kind text,order_id uuid,email_token uuid,booking_id uuid)
language plpgsql security definer set search_path=buykub as $$
declare c stripe_checkout_contexts%rowtype;
begin
  -- Same lock order as refunds and the canonical fulfillment function.
  perform pg_advisory_xact_lock(hashtextextended(p_payment_intent_id,0));
  select * into c from stripe_checkout_contexts where checkout_reference=p_checkout_reference for update;
  if not found or c.stripe_payment_intent_id is distinct from p_payment_intent_id
    or c.amount_cents is distinct from p_amount_cents or p_currency is distinct from 'thb'
    or c.promptpay_buyer_email is null then raise exception 'payment_mismatch'; end if;
  return query select * from finalize_stripe_checkout(c.checkout_reference,c.stripe_session_id,p_payment_intent_id,c.promptpay_buyer_email,null);
end $$;
create function buykub.expire_promptpay_checkout(p_checkout_reference uuid,p_payment_intent_id text)
returns void language plpgsql security definer set search_path=buykub as $$
declare c stripe_checkout_contexts%rowtype;
begin
  select * into c from stripe_checkout_contexts where checkout_reference=p_checkout_reference for update;
  if not found or c.stripe_payment_intent_id is distinct from p_payment_intent_id or c.promptpay_buyer_email is null then raise exception 'payment_mismatch'; end if;
  if c.status='created' then perform cancel_stripe_checkout(c.checkout_reference); end if;
end $$;
-- The cleanup worker's snapshot can predate a concurrent intent/session attach.
-- Lock and recheck all conditions before releasing any stock.
create function buykub.expire_unstarted_stripe_checkout(p_checkout_reference uuid)
returns void language plpgsql security definer set search_path=buykub,pg_temp as $$
declare c stripe_checkout_contexts%rowtype;
begin
  select * into c from stripe_checkout_contexts where checkout_reference=p_checkout_reference for update;
  if found and c.status='created' and c.stripe_payment_intent_id is null
    and (c.stripe_session_id is null or left(c.stripe_session_id,3)='pp_')
    and coalesce(c.promptpay_expires_at,c.created_at+interval '1 hour')<=now()
  then perform cancel_stripe_checkout(c.checkout_reference); end if;
end $$;
revoke all on function buykub.expire_unstarted_stripe_checkout(uuid) from public,anon,authenticated;
grant execute on function buykub.expire_unstarted_stripe_checkout(uuid) to service_role;
revoke all on function buykub.prepare_promptpay_checkout(uuid,text),buykub.attach_promptpay_intent(uuid,text),buykub.finalize_promptpay_checkout(uuid,text,integer,text),buykub.expire_promptpay_checkout(uuid,text) from public,anon,authenticated;
grant execute on function buykub.prepare_promptpay_checkout(uuid,text),buykub.attach_promptpay_intent(uuid,text),buykub.finalize_promptpay_checkout(uuid,text,integer,text),buykub.expire_promptpay_checkout(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
