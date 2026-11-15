-- Drafting from a scanned PDF goes through OCR and is recorded as its own
-- operation. The dashboard already splits spend by model, but both paths use
-- the same model, so splitting by operation is what tells the admin whether
-- scanned files are what consumes the monthly quota.
begin;

create or replace function buykub.agent_usage_dashboard(p_actor uuid, p_limit integer default 50)
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
    'by_operation', coalesce((select jsonb_agg(entry order by entry->>'operation')
      from (select jsonb_build_object(
          'operation', operation,
          'calls', count(*),
          'micros', coalesce(sum(cost_micros), 0),
          'month_calls', count(*) filter (where created_at >= month_start),
          'month_micros', coalesce(sum(cost_micros) filter (where created_at >= month_start), 0)) as entry
        from buykub.agent_usage_events group by operation) operations), '[]'::jsonb),
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

-- `create or replace` keeps the existing privileges; restated so the grant does
-- not depend on what the earlier migration left behind.
revoke all on function buykub.agent_usage_dashboard(uuid, integer) from public, anon, authenticated;
grant execute on function buykub.agent_usage_dashboard(uuid, integer) to service_role;

commit;

notify pgrst, 'reload schema';
