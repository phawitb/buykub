-- Free products skip Stripe Checkout: with nothing to pay there is no Session
-- to confirm. The order gets an opaque pp_ receipt like native PromptPay, so the
-- success page, receipts and course binding keep working unchanged.
begin;
create function buykub.finalize_free_checkout(p_checkout_reference uuid,p_email text)
returns table(kind text,order_id uuid,email_token uuid,booking_id uuid)
language plpgsql security definer set search_path=buykub as $$
declare c stripe_checkout_contexts%rowtype;
begin
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  select * into c from stripe_checkout_contexts where checkout_reference=p_checkout_reference for update;
  if not found or c.kind<>'product' or c.amount_cents<>0 then raise exception 'checkout_not_free'; end if;
  -- A checkout started before this change belongs to its Stripe Session.
  if c.stripe_session_id is not null and left(c.stripe_session_id,3)<>'pp_' then raise exception 'checkout_not_free'; end if;
  if c.stripe_session_id is null then
    update stripe_checkout_contexts set stripe_session_id='pp_'||gen_random_uuid()::text
    where checkout_reference=p_checkout_reference returning * into c;
  end if;
  -- The canonical function is idempotent: a retry returns the same order.
  return query select * from finalize_stripe_checkout(c.checkout_reference,c.stripe_session_id,null,p_email,null);
end $$;
revoke all on function buykub.finalize_free_checkout(uuid,text) from public,anon,authenticated;
grant execute on function buykub.finalize_free_checkout(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
