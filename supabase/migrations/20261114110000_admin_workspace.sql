begin;

create table buykub.admin_user_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  payout_hold boolean not null default false,
  updated_at timestamptz not null default now()
);
create table buykub.admin_content_controls (
  target_kind text not null check (target_kind in ('shop','product')),
  target_id uuid not null,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (target_kind, target_id)
);
create table buykub.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 1 and 100),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2000),
  created_at timestamptz not null default now()
);
create table buykub.platform_site_settings (
  id boolean primary key default true check (id),
  hero_title text not null check (char_length(btrim(hero_title)) between 1 and 160 and hero_title !~ '[<>]'),
  hero_subtitle text not null check (char_length(btrim(hero_subtitle)) between 1 and 500 and hero_subtitle !~ '[<>]'),
  announcement text not null default '' check (char_length(announcement) <= 300 and announcement !~ '[<>]'),
  support_email text not null default '' check (char_length(support_email) <= 254 and (support_email = '' or support_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$')),
  updated_at timestamptz not null default now()
);

alter table buykub.admin_user_controls enable row level security;
alter table buykub.admin_user_controls force row level security;
alter table buykub.admin_content_controls enable row level security;
alter table buykub.admin_content_controls force row level security;
alter table buykub.admin_audit_log enable row level security;
alter table buykub.admin_audit_log force row level security;
alter table buykub.platform_site_settings enable row level security;
alter table buykub.platform_site_settings force row level security;
revoke all on buykub.admin_user_controls, buykub.admin_content_controls, buykub.admin_audit_log, buykub.platform_site_settings from public, anon, authenticated, service_role;
grant select, insert, update on buykub.admin_user_controls, buykub.admin_content_controls, buykub.platform_site_settings to service_role;
grant select, insert on buykub.admin_audit_log to service_role;
revoke all on sequence buykub.admin_audit_log_id_seq from public, anon, authenticated;
grant usage, select on sequence buykub.admin_audit_log_id_seq to service_role;

-- Server-only RPC validates the actor against authoritative auth data again.
create function buykub.assert_platform_admin(p_actor uuid) returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not exists (
    select 1 from auth.users u where u.id = p_actor and lower(u.email) = 'phawit.boo@gmail.com'
      and u.email_confirmed_at is not null
      and (u.raw_app_meta_data->>'provider' = 'google' or exists (
        select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
      ))
  ) then raise exception 'Forbidden' using errcode = '42501'; end if;
end $$;
revoke all on function buykub.assert_platform_admin(uuid) from public, anon, authenticated;
grant execute on function buykub.assert_platform_admin(uuid) to service_role;

create function buykub.admin_apply_action(p_actor uuid, p_action text, p_payload jsonb)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare target uuid; publish boolean; settings jsonb; hold boolean;
begin
  perform buykub.assert_platform_admin(p_actor);
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid payload'; end if;
  if p_action = 'save-user' then
    perform pg_advisory_xact_lock(hashtextextended('seller-payout-ledger',0));
    target := (p_payload->>'userId')::uuid;
    if target is null or not exists (select 1 from buykub.profiles where id = target) then raise exception 'User not found'; end if;
    if jsonb_typeof(p_payload->'note') is distinct from 'string' or char_length(p_payload->>'note') > 2000
      or jsonb_typeof(p_payload->'payoutHold') is distinct from 'boolean' then raise exception 'Invalid user control'; end if;
    hold := (p_payload->>'payoutHold')::boolean;
    insert into buykub.admin_user_controls(user_id,note,payout_hold) values(target,p_payload->>'note',hold)
      on conflict(user_id) do update set note=excluded.note,payout_hold=excluded.payout_hold,updated_at=now();
    insert into buykub.admin_audit_log(actor_id,action,target_id,metadata) values(p_actor,p_action,target,jsonb_build_object('payout_hold',hold));
  elsif p_action in ('set-shop','set-product') then
    target := (p_payload->>'id')::uuid;
    if target is null or jsonb_typeof(p_payload->'published') is distinct from 'boolean' then raise exception 'Invalid publication'; end if;
    publish := (p_payload->>'published')::boolean;
    if p_action = 'set-shop' then
      perform 1 from buykub.shops where id=target for update;
    else
      perform 1 from buykub.products where id=target for update;
    end if;
    if not found then raise exception 'Content not found'; end if;
    insert into buykub.admin_content_controls(target_kind,target_id,hidden)
      values(case when p_action='set-shop' then 'shop' else 'product' end,target,not publish)
      on conflict(target_kind,target_id) do update set hidden=excluded.hidden,updated_at=now();
    if p_action = 'set-shop' then update buykub.shops set published=publish where id=target;
    else update buykub.products set published=publish where id=target; end if;
    insert into buykub.admin_audit_log(actor_id,action,target_id,metadata) values(p_actor,p_action,target,jsonb_build_object('published',publish));
  elsif p_action = 'save-site' then
    settings := p_payload;
    if jsonb_typeof(settings->'hero_title') is distinct from 'string' or jsonb_typeof(settings->'hero_subtitle') is distinct from 'string'
      or jsonb_typeof(settings->'announcement') is distinct from 'string' or jsonb_typeof(settings->'support_email') is distinct from 'string'
      then raise exception 'Invalid site settings'; end if;
    insert into buykub.platform_site_settings(id,hero_title,hero_subtitle,announcement,support_email)
      values(true,settings->>'hero_title',settings->>'hero_subtitle',settings->>'announcement',settings->>'support_email')
      on conflict(id) do update set hero_title=excluded.hero_title,hero_subtitle=excluded.hero_subtitle,announcement=excluded.announcement,support_email=excluded.support_email,updated_at=now();
    insert into buykub.admin_audit_log(actor_id,action,metadata) values(p_actor,p_action,'{}');
  else raise exception 'Unknown admin action'; end if;
end $$;
revoke all on function buykub.admin_apply_action(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function buykub.admin_apply_action(uuid,text,jsonb) to service_role;

-- Triggers cover direct REST writes and existing checkout functions, including
-- service-role checkout. Updates to existing orders remain available for paid
-- purchases, fulfilment, refunds and accounting after a publication takedown.
create function buykub.enforce_admin_publication() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.published and exists (select 1 from buykub.admin_content_controls
    where target_kind = case when tg_table_name='shops' then 'shop' else 'product' end and target_id=new.id and hidden)
    then raise exception 'Publication is restricted by platform moderation' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if tg_table_name='shops' then
      if new.owner_id <> old.owner_id then raise exception 'Shop owner cannot be changed'; end if;
    else
      if new.shop_id <> old.shop_id then raise exception 'Product shop cannot be changed'; end if;
    end if;
    if new.id <> old.id then raise exception 'Content ID cannot be changed'; end if;
  end if;
  return new;
end $$;
create trigger enforce_shop_moderation before insert or update on buykub.shops for each row execute function buykub.enforce_admin_publication();
create trigger enforce_product_moderation before insert or update on buykub.products for each row execute function buykub.enforce_admin_publication();
revoke all on function buykub.enforce_admin_publication() from public, anon, authenticated;

create function buykub.enforce_checkout_publication() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare shop_ok boolean; product_ok boolean;
begin
  select published into shop_ok from buykub.shops where id=new.shop_id for share;
  if shop_ok is distinct from true or exists(select 1 from buykub.admin_content_controls where target_kind='shop' and target_id=new.shop_id and hidden)
    then raise exception 'This shop is not available for new checkout' using errcode='42501'; end if;
  if new.product_id is not null then
    select published into product_ok from buykub.products where id=new.product_id and shop_id=new.shop_id for share;
    if product_ok is distinct from true or exists(select 1 from buykub.admin_content_controls where target_kind='product' and target_id=new.product_id and hidden)
      then raise exception 'This product is not available for new checkout' using errcode='42501'; end if;
  end if;
  return new;
end $$;
create trigger enforce_checkout_moderation before insert on buykub.stripe_checkout_contexts for each row execute function buykub.enforce_checkout_publication();
revoke all on function buykub.enforce_checkout_publication() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
