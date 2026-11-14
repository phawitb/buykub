-- Service-only payout accounting. This migration NEVER moves money.
begin;
create table buykub.seller_payout_settings (
  singleton boolean primary key default true check(singleton),
  mode text not null default 'manual' check(mode='manual'),
  schedule_enabled boolean not null default false,
  last_reconciled_at timestamptz
);
insert into buykub.seller_payout_settings(singleton) values(true);
create table buykub.seller_payout_observations (
  order_id uuid primary key references buykub.orders(id) on delete restrict,
  payment_intent_id text, charge_id text, balance_transaction_id text,
  eligible boolean not null default false, reason text not null,
  gross_cents bigint not null check(gross_cents>=0), refunded_cents bigint not null default 0 check(refunded_cents>=0),
  net_cents bigint not null default 0 check(net_cents>=0), checked_at timestamptz not null
);
create table buykub.seller_payout_batches (
  id uuid primary key default gen_random_uuid(), request_key text not null unique,
  shop_id uuid not null references buykub.shops(id) on delete restrict,
  status text not null default 'ready' check(status in ('ready','completed','cancelled','review_required')),
  amount_cents bigint not null check(amount_cents>0),
  recipient_snapshot jsonb not null, profile_fingerprint text not null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  completion_review_required boolean not null default false,
  completed_by uuid references auth.users(id), paid_at timestamptz, transfer_reference text unique,
  check((status='completed')=(paid_at is not null and transfer_reference is not null))
);
create table buykub.seller_payout_allocations (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references buykub.seller_payout_batches(id),
  order_id uuid not null references buykub.orders(id) on delete restrict,
  payment_intent_id text not null, charge_id text not null,
  gross_cents bigint not null, refunded_cents bigint not null, net_cents bigint not null check(net_cents>0),
  released_at timestamptz
);
create unique index seller_payout_order_once on buykub.seller_payout_allocations(order_id) where released_at is null;
-- A duplicated/corrupted order with the same charge must never be allocated twice.
create unique index seller_payout_charge_once on buykub.seller_payout_allocations(charge_id) where released_at is null;
create unique index seller_payout_intent_once on buykub.seller_payout_allocations(payment_intent_id) where released_at is null;
create table buykub.seller_payout_events (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
  batch_id uuid references buykub.seller_payout_batches(id), action text not null,
  created_at timestamptz not null default now()
);

create table buykub.seller_payout_slips (
 batch_id uuid primary key references buykub.seller_payout_batches(id),
 object_path text not null unique, mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp','application/pdf')),
 size_bytes integer not null check(size_bytes between 1 and 5242880),
 uploaded_by uuid references auth.users(id), uploaded_at timestamptz not null default now()
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('seller-payout-slips','seller-payout-slips',false,5242880,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Deliberately NO anon/authenticated storage policy: only trusted server upload
-- and short-lived signed download URLs can access this private bucket.
create function buykub.attach_seller_payout_slip(p_actor uuid,p_batch uuid,p_path text,p_mime text,p_size integer)
returns text language plpgsql security definer set search_path=pg_catalog,buykub as $$
declare b buykub.seller_payout_batches%rowtype; previous text;
begin
 perform buykub.assert_platform_admin(p_actor);
 perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
 select * into b from buykub.seller_payout_batches where id=p_batch for update;
 if not found or b.status='cancelled' then raise check_violation using message='batch_not_available'; end if;
 select object_path into previous from buykub.seller_payout_slips where batch_id=p_batch;
 if previous is not null and b.status='completed' then raise check_violation using message='completed_slip_immutable'; end if;
 if p_path not like p_batch::text||'/%' or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$' then raise check_violation using message='invalid_slip_path'; end if;
 insert into buykub.seller_payout_slips(batch_id,object_path,mime_type,size_bytes,uploaded_by)
 values(p_batch,p_path,p_mime,p_size,p_actor) on conflict(batch_id) do update set object_path=excluded.object_path,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_by=excluded.uploaded_by,uploaded_at=now();
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,p_batch,case when previous is null then 'slip_attached' else 'slip_replaced' end);
 return previous;
end $$;
create function buykub.record_seller_payout_observation(p_observation jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,buykub as $$
begin
 insert into buykub.seller_payout_observations select * from jsonb_populate_record(null::buykub.seller_payout_observations,p_observation)
 on conflict(order_id) do update set payment_intent_id=excluded.payment_intent_id,charge_id=excluded.charge_id,balance_transaction_id=excluded.balance_transaction_id,
 eligible=excluded.eligible,reason=excluded.reason,gross_cents=excluded.gross_cents,refunded_cents=excluded.refunded_cents,net_cents=excluded.net_cents,checked_at=excluded.checked_at
 where excluded.checked_at>seller_payout_observations.checked_at
 or (excluded.checked_at=seller_payout_observations.checked_at and not excluded.eligible);
end $$;
create function buykub.audit_seller_payout_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,buykub as $$
begin
 if new.actor_id is not null then insert into buykub.admin_audit_log(actor_id,action,target_id,metadata)
 values(new.actor_id,'payout.'||new.action,new.batch_id,'{}'::jsonb); end if;
 return new;
end $$;
create trigger audit_seller_payout_event after insert on buykub.seller_payout_events for each row execute function buykub.audit_seller_payout_event();
revoke all on function buykub.attach_seller_payout_slip(uuid,uuid,text,text,integer),buykub.record_seller_payout_observation(jsonb),buykub.audit_seller_payout_event() from public,anon,authenticated;
grant execute on function buykub.attach_seller_payout_slip(uuid,uuid,text,text,integer),buykub.record_seller_payout_observation(jsonb) to service_role;

create function buykub.seller_payout_profile_valid(p buykub.seller_payout_profiles)
returns boolean language sql stable set search_path=pg_catalog,buykub as $$
 select coalesce(buykub.valid_payout_thai_name(p.full_name_th)
 and p.contact_phone ~ '^0[0-9]{9}$' and buykub.valid_thai_national_id(p.national_id)
 and char_length(btrim(p.address_line)) between 1 and 500
 and char_length(btrim(p.subdistrict)) between 1 and 100
 and char_length(btrim(p.district)) between 1 and 100
 and char_length(btrim(p.province)) between 1 and 100 and p.postal_code ~ '^[0-9]{5}$'
 and case when p.payout_method='promptpay' then p.promptpay_id ~ '^([0-9]{10}|[0-9]{13})$' and p.bank_details is null
 when p.payout_method='bank' and buykub.valid_payout_bank_details(p.bank_details) then p.promptpay_id is null
 and regexp_replace(btrim(normalize((p.bank_details::jsonb)->>'accountName',NFC)), '\s+', ' ', 'g')=regexp_replace(btrim(normalize(p.full_name_th,NFC)), '\s+', ' ', 'g')
 else false end,false)
$$;
create function buykub.seller_payout_shop_requires_review(p_shop uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,buykub as $$
 select exists(select 1 from buykub.seller_payout_allocations a
 join buykub.seller_payout_batches b on b.id=a.batch_id
 left join buykub.seller_payout_observations v on v.order_id=a.order_id
 join buykub.orders o on o.id=a.order_id
 where b.shop_id=p_shop and b.status='completed' and a.released_at is null
 and (o.status<>'paid' or o.mock or o.payment_method is distinct from 'stripe' or o.price_cents<>a.gross_cents or o.stripe_payment_intent_id is distinct from a.payment_intent_id or v.order_id is null or not v.eligible or v.checked_at < now()-interval '5 minutes'
 or v.refunded_cents>a.refunded_cents or v.net_cents<a.net_cents or v.charge_id<>a.charge_id or v.payment_intent_id<>a.payment_intent_id))
$$;
create function buykub.prepare_seller_payout_batch(p_actor uuid,p_request text,p_shop uuid)
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
 select sum(v.net_cents) into total from buykub.seller_payout_observations v join buykub.orders o on o.id=v.order_id
 where o.shop_id=p_shop and o.status='paid' and not o.mock and o.payment_method='stripe' and o.price_cents>0
 and o.paid_at<=now()-interval '7 days' and o.stripe_payment_intent_id=v.payment_intent_id
 and o.price_cents=v.gross_cents and v.eligible and v.checked_at>=now()-interval '5 minutes'
 and v.net_cents=(v.gross_cents-v.refunded_cents)-floor(((v.gross_cents-v.refunded_cents)*5+50)::numeric/100)
 and not exists(select 1 from buykub.seller_payout_allocations a where a.order_id=o.id and a.released_at is null);
 if total is null or total<=0 then return null; end if;
 snapshot:=jsonb_build_object('recipientName',p.full_name_th,'method',p.payout_method,
 'bankCode',case when p.payout_method='bank' then p.bank_details::jsonb->>'bankCode' end,
 'accountNumber',case when p.payout_method='bank' then p.bank_details::jsonb->>'accountNumber' end,
 'promptpayId',p.promptpay_id);
 insert into buykub.seller_payout_batches(request_key,shop_id,amount_cents,recipient_snapshot,profile_fingerprint,created_by)
 values(p_request||':'||p_shop::text,p_shop,total,snapshot,md5(to_jsonb(p)::text),p_actor) returning id into b;
 insert into buykub.seller_payout_allocations(batch_id,order_id,payment_intent_id,charge_id,gross_cents,refunded_cents,net_cents)
 select b,o.id,v.payment_intent_id,v.charge_id,v.gross_cents,v.refunded_cents,v.net_cents
 from buykub.seller_payout_observations v join buykub.orders o on o.id=v.order_id
 where o.shop_id=p_shop and o.status='paid' and not o.mock and o.payment_method='stripe' and o.price_cents>0
 and o.paid_at<=now()-interval '7 days' and o.stripe_payment_intent_id=v.payment_intent_id
 and o.price_cents=v.gross_cents and v.eligible and v.checked_at>=now()-interval '5 minutes'
 and v.net_cents=(v.gross_cents-v.refunded_cents)-floor(((v.gross_cents-v.refunded_cents)*5+50)::numeric/100)
 and not exists(select 1 from buykub.seller_payout_allocations a where a.order_id=o.id and a.released_at is null);
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,b,'prepared_for_manual_transfer');
 return b;
end $$;
create function buykub.cancel_seller_payout_batch(p_actor uuid,p_batch uuid)
returns void language plpgsql security definer set search_path=pg_catalog,buykub as $$
declare b buykub.seller_payout_batches%rowtype;
begin
 if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
 perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
 select * into b from buykub.seller_payout_batches where id=p_batch for update;
 if not found then raise check_violation using message='batch_missing'; end if;
 if b.status='cancelled' then return; end if;
 if b.status not in ('ready','review_required') then raise check_violation using message='cannot_cancel_completed_payout'; end if;
 if exists(select 1 from buykub.seller_payout_slips where batch_id=p_batch) then raise check_violation using message='slip_attached_possible_transfer_do_not_cancel'; end if;
 update buykub.seller_payout_allocations set released_at=now() where batch_id=p_batch and released_at is null;
 update buykub.seller_payout_batches set status='cancelled' where id=p_batch;
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,p_batch,'cancelled');
end $$;
create function buykub.complete_manual_seller_payout(p_actor uuid,p_batch uuid,p_reference text,p_paid_at timestamptz)
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
 insert into buykub.seller_payout_events(actor_id,batch_id,action) values(p_actor,p_batch,case when needs_review then 'manual_transfer_attested_requires_review' else 'manual_transfer_attested' end);
end $$;
create function buykub.configure_seller_payouts(p_actor uuid,p_mode text,p_schedule boolean)
returns void language plpgsql security definer set search_path=pg_catalog,buykub as $$
begin
 if p_actor is not null then perform buykub.assert_platform_admin(p_actor); end if;
 if p_mode is distinct from 'manual' then raise check_violation using message='bank_transfer_provider_not_connected'; end if;
 update buykub.seller_payout_settings set mode=p_mode,schedule_enabled=p_schedule where singleton;
 insert into buykub.seller_payout_events(actor_id,action) values(p_actor,'manual_mode_schedule_updated');
end $$;


create function buykub.review_seller_payout_batches()
returns void language plpgsql security definer set search_path=pg_catalog,buykub as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
 update buykub.seller_payout_batches b set status='review_required'
 where b.status='ready' and (
 not exists(select 1 from buykub.seller_payout_profiles p where p.shop_id=b.shop_id and buykub.seller_payout_profile_valid(p) and md5(to_jsonb(p)::text)=b.profile_fingerprint)
 or exists(select 1 from buykub.shops s join buykub.admin_user_controls c on c.user_id=s.owner_id where s.id=b.shop_id and c.payout_hold)
 or buykub.seller_payout_shop_requires_review(b.shop_id)
 or exists(select 1 from buykub.seller_payout_allocations a join buykub.orders o on o.id=a.order_id left join buykub.seller_payout_observations v on v.order_id=a.order_id where a.batch_id=b.id
 and (v.order_id is null or not v.eligible or v.checked_at<now()-interval '5 minutes' or v.net_cents<>a.net_cents or v.refunded_cents<>a.refunded_cents
 or v.charge_id is distinct from a.charge_id or v.payment_intent_id is distinct from a.payment_intent_id or o.status<>'paid' or o.mock or o.price_cents<>a.gross_cents)));
end $$;
revoke all on function buykub.review_seller_payout_batches() from public,anon,authenticated;
grant execute on function buykub.review_seller_payout_batches() to service_role;

do $$ declare n text; begin
 foreach n in array array['seller_payout_settings','seller_payout_observations','seller_payout_batches','seller_payout_allocations','seller_payout_events','seller_payout_slips'] loop
 execute format('alter table buykub.%I enable row level security',n);
 execute format('alter table buykub.%I force row level security',n);
 execute format('revoke all on buykub.%I from public,anon,authenticated',n);
 execute format('grant all on buykub.%I to service_role',n);
 end loop;
end $$;
grant usage,select on sequence buykub.seller_payout_events_id_seq to service_role;
revoke all on function buykub.seller_payout_profile_valid(buykub.seller_payout_profiles),buykub.seller_payout_shop_requires_review(uuid),buykub.prepare_seller_payout_batch(uuid,text,uuid),buykub.cancel_seller_payout_batch(uuid,uuid),buykub.complete_manual_seller_payout(uuid,uuid,text,timestamptz),buykub.configure_seller_payouts(uuid,text,boolean) from public,anon,authenticated;
grant execute on function buykub.seller_payout_profile_valid(buykub.seller_payout_profiles),buykub.seller_payout_shop_requires_review(uuid),buykub.prepare_seller_payout_batch(uuid,text,uuid),buykub.cancel_seller_payout_batch(uuid,uuid),buykub.complete_manual_seller_payout(uuid,uuid,text,timestamptz),buykub.configure_seller_payouts(uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
