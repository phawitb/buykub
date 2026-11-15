begin;

-- Agent spend, per call. Costs are micro-USD integers (1e6 micros = 1 USD) so
-- totals stay exact; the application computes them from DeepSeek token counts.
create table buykub.agent_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (char_length(operation) between 1 and 40),
  model text not null check (char_length(model) between 1 and 60),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  cost_micros bigint not null check (cost_micros >= 0),
  created_at timestamptz not null default now()
);
create index agent_usage_events_user_created_idx
  on buykub.agent_usage_events (user_id, created_at desc);
create index agent_usage_events_created_idx
  on buykub.agent_usage_events (created_at desc);

-- Per-seller monthly ceiling. No row means the platform default applies.
-- -1 is unlimited and 0 blocks the seller from using the agent at all.
create table buykub.agent_user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_limit_micros bigint not null check (monthly_limit_micros >= -1),
  updated_at timestamptz not null default now()
);

create table buykub.agent_settings (
  id boolean primary key default true check (id),
  default_monthly_limit_micros bigint not null default 300000
    check (default_monthly_limit_micros between 0 and 1000000000),
  updated_at timestamptz not null default now()
);
insert into buykub.agent_settings (id) values (true) on conflict (id) do nothing;

-- Seller-owned preferences for the preview images built from an uploaded PDF.
create table buykub.seller_pdf_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preview_page_count smallint not null default 3 check (preview_page_count between 1 and 5),
  watermark_enabled boolean not null default true,
  watermark_text text not null default '' check (char_length(watermark_text) <= 40 and watermark_text !~ '[<>]'),
  blur_strength smallint not null default 6 check (blur_strength between 0 and 20),
  watermark_opacity smallint not null default 35 check (watermark_opacity between 5 and 100),
  updated_at timestamptz not null default now()
);

alter table buykub.agent_usage_events enable row level security;
alter table buykub.agent_usage_events force row level security;
alter table buykub.agent_user_limits enable row level security;
alter table buykub.agent_user_limits force row level security;
alter table buykub.agent_settings enable row level security;
alter table buykub.agent_settings force row level security;
alter table buykub.seller_pdf_preferences enable row level security;

revoke all on buykub.agent_usage_events, buykub.agent_user_limits, buykub.agent_settings
  from public, anon, authenticated, service_role;
grant select, insert on buykub.agent_usage_events to service_role;
grant select, insert, update on buykub.agent_user_limits, buykub.agent_settings to service_role;
revoke all on sequence buykub.agent_usage_events_id_seq from public, anon, authenticated;
grant usage, select on sequence buykub.agent_usage_events_id_seq to service_role;

-- Preferences are the seller's own setting, read and written with their session.
revoke all on buykub.seller_pdf_preferences from public, anon;
grant select, insert, update on buykub.seller_pdf_preferences to authenticated, service_role;
create policy "sellers read their pdf preferences" on buykub.seller_pdf_preferences
  for select using (auth.uid() = user_id);
create policy "sellers create their pdf preferences" on buykub.seller_pdf_preferences
  for insert with check (auth.uid() = user_id);
create policy "sellers update their pdf preferences" on buykub.seller_pdf_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Months follow Asia/Bangkok, the timezone the dashboard reports in.
create function buykub.agent_month_start() returns timestamptz
language sql stable set search_path = pg_catalog as $$
  select (date_trunc('month', (now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok');
$$;

create function buykub.agent_effective_limit(p_user uuid) returns bigint
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(
    (select monthly_limit_micros from buykub.agent_user_limits where user_id = p_user),
    (select default_monthly_limit_micros from buykub.agent_settings where id),
    300000
  );
$$;

/**
 * Allowance for this calendar month. `limit_micros` of -1 means unlimited.
 * Called before a paid request; the matching record call follows it.
 */
create function buykub.agent_usage_status(p_user uuid)
returns table (limit_micros bigint, used_micros bigint)
language sql stable security definer set search_path = pg_catalog as $$
  select buykub.agent_effective_limit(p_user),
    coalesce((
      select sum(cost_micros) from buykub.agent_usage_events
      where user_id = p_user and created_at >= buykub.agent_month_start()
    ), 0)::bigint;
$$;

create function buykub.agent_record_usage(
  p_user uuid, p_operation text, p_model text,
  p_prompt_tokens integer, p_cached_tokens integer,
  p_completion_tokens integer, p_cost_micros bigint
) returns bigint
language plpgsql security definer set search_path = pg_catalog as $$
declare used bigint;
begin
  insert into buykub.agent_usage_events (
    user_id, operation, model, prompt_tokens, cached_tokens, completion_tokens, cost_micros
  ) values (
    p_user, p_operation, p_model,
    greatest(0, coalesce(p_prompt_tokens, 0)), greatest(0, coalesce(p_cached_tokens, 0)),
    greatest(0, coalesce(p_completion_tokens, 0)), greatest(0, coalesce(p_cost_micros, 0))
  );
  select coalesce(sum(cost_micros), 0) into used from buykub.agent_usage_events
    where user_id = p_user and created_at >= buykub.agent_month_start();
  return used;
end $$;

/** Everything the admin agent panel shows, in one round trip. */
create function buykub.agent_usage_dashboard(p_actor uuid, p_limit integer default 50)
returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare rows_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  month_start timestamptz := buykub.agent_month_start();
  result jsonb;
begin
  perform buykub.assert_platform_admin(p_actor);
  select jsonb_build_object(
    'default_limit_micros', (select default_monthly_limit_micros from buykub.agent_settings where id),
    'month_start', month_start,
    'month', (select jsonb_build_object(
        'micros', coalesce(sum(cost_micros), 0), 'calls', count(*),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0), 'completion_tokens', coalesce(sum(completion_tokens), 0))
      from buykub.agent_usage_events where created_at >= month_start),
    'total', (select jsonb_build_object(
        'micros', coalesce(sum(cost_micros), 0), 'calls', count(*),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0), 'completion_tokens', coalesce(sum(completion_tokens), 0))
      from buykub.agent_usage_events),
    'by_model', coalesce((select jsonb_agg(entry order by entry->>'model')
      from (select jsonb_build_object('model', model, 'calls', count(*), 'micros', coalesce(sum(cost_micros), 0)) as entry
        from buykub.agent_usage_events group by model) models), '[]'::jsonb),
    'sellers', coalesce((select jsonb_agg(seller order by (seller->>'month_micros')::bigint desc, seller->>'user_id')
      from (
        select jsonb_build_object(
          'user_id', usage.user_id,
          'email', profiles.email,
          'full_name', profiles.full_name,
          'month_micros', usage.month_micros,
          'total_micros', usage.total_micros,
          'month_calls', usage.month_calls,
          'total_calls', usage.total_calls,
          'last_used_at', usage.last_used_at,
          'limit_micros', buykub.agent_effective_limit(usage.user_id),
          'limit_overridden', exists (select 1 from buykub.agent_user_limits l where l.user_id = usage.user_id)
        ) as seller
        from (
          select user_id,
            coalesce(sum(cost_micros) filter (where created_at >= month_start), 0)::bigint as month_micros,
            coalesce(sum(cost_micros), 0)::bigint as total_micros,
            count(*) filter (where created_at >= month_start) as month_calls,
            count(*) as total_calls,
            max(created_at) as last_used_at
          from buykub.agent_usage_events group by user_id
          order by month_micros desc, user_id limit rows_limit
        ) usage
        left join buykub.profiles on profiles.id = usage.user_id
      ) sellers), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', l.user_id, 'email', p.email, 'full_name', p.full_name,
        'limit_micros', l.monthly_limit_micros, 'updated_at', l.updated_at) order by l.updated_at desc)
      from buykub.agent_user_limits l left join buykub.profiles p on p.id = l.user_id), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create function buykub.admin_set_agent_limit(p_actor uuid, p_user uuid, p_limit bigint)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform buykub.assert_platform_admin(p_actor);
  if p_user is null or not exists (select 1 from buykub.profiles where id = p_user) then
    raise exception 'User not found';
  end if;
  if p_limit is null then
    delete from buykub.agent_user_limits where user_id = p_user;
    insert into buykub.admin_audit_log (actor_id, action, target_id, metadata)
      values (p_actor, 'agent.limit_cleared', p_user, '{}'::jsonb);
    return;
  end if;
  if p_limit < -1 or p_limit > 1000000000 then raise exception 'Invalid agent limit'; end if;
  insert into buykub.agent_user_limits (user_id, monthly_limit_micros) values (p_user, p_limit)
    on conflict (user_id) do update set monthly_limit_micros = excluded.monthly_limit_micros, updated_at = now();
  insert into buykub.admin_audit_log (actor_id, action, target_id, metadata)
    values (p_actor, 'agent.limit_set', p_user, jsonb_build_object('limit_micros', p_limit));
end $$;

create function buykub.admin_set_agent_default_limit(p_actor uuid, p_limit bigint)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform buykub.assert_platform_admin(p_actor);
  if p_limit is null or p_limit < 0 or p_limit > 1000000000 then raise exception 'Invalid agent limit'; end if;
  insert into buykub.agent_settings (id, default_monthly_limit_micros) values (true, p_limit)
    on conflict (id) do update set default_monthly_limit_micros = excluded.default_monthly_limit_micros, updated_at = now();
  insert into buykub.admin_audit_log (actor_id, action, metadata)
    values (p_actor, 'agent.default_limit_set', jsonb_build_object('limit_micros', p_limit));
end $$;

revoke all on function buykub.agent_month_start() from public, anon, authenticated;
revoke all on function buykub.agent_effective_limit(uuid) from public, anon, authenticated;
revoke all on function buykub.agent_usage_status(uuid) from public, anon, authenticated;
revoke all on function buykub.agent_record_usage(uuid, text, text, integer, integer, integer, bigint) from public, anon, authenticated;
revoke all on function buykub.agent_usage_dashboard(uuid, integer) from public, anon, authenticated;
revoke all on function buykub.admin_set_agent_limit(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function buykub.admin_set_agent_default_limit(uuid, bigint) from public, anon, authenticated;
grant execute on function buykub.agent_usage_status(uuid) to service_role;
grant execute on function buykub.agent_record_usage(uuid, text, text, integer, integer, integer, bigint) to service_role;
grant execute on function buykub.agent_usage_dashboard(uuid, integer) to service_role;
grant execute on function buykub.admin_set_agent_limit(uuid, uuid, bigint) to service_role;
grant execute on function buykub.admin_set_agent_default_limit(uuid, bigint) to service_role;

notify pgrst, 'reload schema';
commit;
