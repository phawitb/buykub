-- Isolated fixture only; no production data is accessed or retained.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select gen_random_uuid() administrator, gen_random_uuid() seller, gen_random_uuid() other \gset
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
(:'administrator','phawit.boo@gmail.com',now(),'{"provider":"google"}'),
(:'seller','agent-test@example.com',now(),'{"provider":"google"}'),
(:'other','agent-other@example.com',now(),'{"provider":"google"}');
insert into buykub.profiles(id,email) values
(:'administrator','phawit.boo@gmail.com'),(:'seller','agent-test@example.com'),(:'other','agent-other@example.com');
select set_config('test.admin.id',:'administrator',true),set_config('test.seller.id',:'seller',true),set_config('test.other.id',:'other',true);

-- Spend and limits are service-role only; preferences are the seller's own row.
do $$ declare t text;
begin
  foreach t in array array['agent_usage_events','agent_user_limits','agent_settings'] loop
    assert not has_table_privilege('anon','buykub.'||t,'select'), t||' hidden from anon';
    assert not has_table_privilege('authenticated','buykub.'||t,'select'), t||' hidden from authenticated';
    assert not has_table_privilege('authenticated','buykub.'||t,'insert'), t||' not writable by authenticated';
    assert not has_table_privilege('authenticated','buykub.'||t,'update'), t||' not updatable by authenticated';
    assert (select relrowsecurity and relforcerowsecurity from pg_class where oid=('buykub.'||t)::regclass), t||' forces RLS';
  end loop;
  assert not has_table_privilege('anon','buykub.seller_pdf_preferences','select'), 'preferences hidden from anon';
  assert has_table_privilege('authenticated','buykub.seller_pdf_preferences','select'), 'seller can read own preferences';
  assert (select relrowsecurity from pg_class where oid='buykub.seller_pdf_preferences'::regclass), 'preferences use RLS';
  assert not has_function_privilege('authenticated','buykub.agent_usage_status(uuid)','execute'), 'quota lookup is server-side';
  assert not has_function_privilege('authenticated','buykub.agent_record_usage(uuid,text,text,integer,integer,integer,bigint)','execute'), 'spend cannot be written from a session';
  assert not has_function_privilege('authenticated','buykub.agent_usage_dashboard(uuid,integer)','execute'), 'dashboard is server-side';
  assert not has_function_privilege('anon','buykub.admin_set_agent_limit(uuid,uuid,bigint)','execute'), 'limits cannot be set anonymously';
end $$;

-- A seller with no override gets the platform default and spends against it.
do $$ declare configured bigint; used bigint; running bigint;
begin
  select default_monthly_limit_micros into configured from buykub.agent_settings where id;
  select limit_micros, used_micros into used, running from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert used = configured, 'default limit applies with no override';
  assert running = 0, 'a new seller has spent nothing this month';
  running := buykub.agent_record_usage(current_setting('test.seller.id')::uuid,'product-draft','deepseek-flash',1085,0,1178,870);
  assert running = 870, 'first draft recorded';
  running := buykub.agent_record_usage(current_setting('test.seller.id')::uuid,'product-draft','deepseek-flash',900,320,700,610);
  assert running = 1480, 'month total accumulates';
  select used_micros into running from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert running = 1480, 'status reports the same total';
  assert (select count(*) = 1 from buykub.agent_usage_events
    where user_id = current_setting('test.seller.id')::uuid and cached_tokens = 320), 'cached tokens are kept for pricing';
end $$;

-- Spend before this month is outside the quota window.
do $$ declare running bigint;
begin
  insert into buykub.agent_usage_events(user_id,operation,model,prompt_tokens,cached_tokens,completion_tokens,cost_micros,created_at)
  values(current_setting('test.seller.id')::uuid,'product-draft','deepseek-flash',1000,0,1000,500000,
    buykub.agent_month_start() - interval '1 day');
  select used_micros into running from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert running = 1480, 'last month does not count against this month';
end $$;

-- Only the platform admin may move a limit, and only within range.
do $$ declare denied boolean; ceiling bigint;
begin
  denied := false;
  begin perform buykub.admin_set_agent_limit(current_setting('test.seller.id')::uuid,current_setting('test.seller.id')::uuid,999999);
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'a seller cannot raise their own limit';

  denied := false;
  begin perform buykub.agent_usage_dashboard(current_setting('test.seller.id')::uuid,50);
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'a seller cannot read platform spend';

  perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,current_setting('test.seller.id')::uuid,50000);
  select limit_micros into ceiling from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert ceiling = 50000, 'per-seller limit applies';

  perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,current_setting('test.seller.id')::uuid,-1);
  select limit_micros into ceiling from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert ceiling = -1, 'unlimited is representable';

  perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,current_setting('test.seller.id')::uuid,0);
  select limit_micros into ceiling from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert ceiling = 0, 'zero blocks the seller';

  perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,current_setting('test.seller.id')::uuid,null);
  select limit_micros into ceiling from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert ceiling = (select default_monthly_limit_micros from buykub.agent_settings where id), 'clearing restores the default';

  denied := false;
  begin perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,current_setting('test.seller.id')::uuid,-2);
  exception when others then denied := true; end;
  assert denied, 'below the unlimited sentinel is refused';

  denied := false;
  begin perform buykub.admin_set_agent_default_limit(current_setting('test.admin.id')::uuid,-1);
  exception when others then denied := true; end;
  assert denied, 'the platform default cannot be unlimited';

  perform buykub.admin_set_agent_default_limit(current_setting('test.admin.id')::uuid,750000);
  select limit_micros into ceiling from buykub.agent_usage_status(current_setting('test.seller.id')::uuid);
  assert ceiling = 750000, 'a seller on the default follows a changed default';

  denied := false;
  begin perform buykub.admin_set_agent_limit(current_setting('test.admin.id')::uuid,gen_random_uuid(),1000);
  exception when others then denied := true; end;
  assert denied, 'a limit needs a real account';
end $$;

-- The dashboard reports this seller's spend to the admin.
do $$ declare report jsonb; row_for_seller jsonb;
begin
  report := buykub.agent_usage_dashboard(current_setting('test.admin.id')::uuid,50);
  assert (report->'month'->>'micros')::bigint >= 1480, 'month total includes the recorded drafts';
  assert (report->'total'->>'micros')::bigint >= 501480, 'lifetime total includes earlier months';
  select value into row_for_seller from jsonb_array_elements(report->'sellers') value
    where value->>'user_id' = current_setting('test.seller.id');
  assert row_for_seller is not null, 'the seller appears in the breakdown';
  assert (row_for_seller->>'month_micros')::bigint = 1480, 'per-seller month spend is reported';
  assert (row_for_seller->>'month_calls')::bigint = 2, 'per-seller call count is reported';
  assert row_for_seller->>'email' = 'agent-test@example.com', 'the seller is identifiable';
  assert (row_for_seller->>'limit_overridden')::boolean = false, 'a cleared override reports as default';
  assert jsonb_array_length(report->'by_model') >= 1, 'spend is split by model';
end $$;

-- Every limit change is on the audit log.
do $$ begin
  assert (select count(*) >= 5 from buykub.admin_audit_log
    where actor_id = current_setting('test.admin.id')::uuid and action like 'agent.%'), 'limit changes are audited';
  assert (select count(*) = 1 from buykub.admin_audit_log
    where actor_id = current_setting('test.admin.id')::uuid and action = 'agent.limit_cleared'), 'clearing is audited';
end $$;

-- Preference bounds hold at the database, not only in the form.
insert into buykub.seller_pdf_preferences(user_id,preview_page_count,watermark_text,blur_strength,watermark_opacity)
values(current_setting('test.seller.id')::uuid,4,'ห้ามคัดลอก',12,60);
do $$ declare denied boolean;
begin
  assert (select preview_page_count = 4 and watermark_enabled and blur_strength = 12
    from buykub.seller_pdf_preferences where user_id = current_setting('test.seller.id')::uuid), 'preferences round-trip';
  denied := false;
  begin insert into buykub.seller_pdf_preferences(user_id,preview_page_count) values(current_setting('test.other.id')::uuid,9);
  exception when check_violation then denied := true; end;
  assert denied, 'more preview pages than image slots is refused';
  denied := false;
  begin insert into buykub.seller_pdf_preferences(user_id,blur_strength) values(current_setting('test.other.id')::uuid,99);
  exception when check_violation then denied := true; end;
  assert denied, 'blur beyond the supported range is refused';
  denied := false;
  begin insert into buykub.seller_pdf_preferences(user_id,watermark_text) values(current_setting('test.other.id')::uuid,'<script>');
  exception when check_violation then denied := true; end;
  assert denied, 'markup in the watermark is refused';
end $$;

-- One seller cannot read or write another seller's preferences.
select set_config('request.jwt.claim.sub',current_setting('test.other.id'),true);
set local role authenticated;
do $$ declare denied boolean; touched integer;
begin
  assert (select count(*) = 0 from buykub.seller_pdf_preferences), 'another seller row is invisible';
  denied := false;
  begin insert into buykub.seller_pdf_preferences(user_id,blur_strength) values(current_setting('test.seller.id')::uuid,20);
  exception when insufficient_privilege then denied := true; when unique_violation then denied := true; end;
  assert denied, 'cannot create a row for another seller';
  update buykub.seller_pdf_preferences set blur_strength = 20 where user_id = current_setting('test.seller.id')::uuid;
  get diagnostics touched = row_count;
  assert touched = 0, 'cannot update another seller row';
  insert into buykub.seller_pdf_preferences(user_id,blur_strength) values(current_setting('test.other.id')::uuid,3);
  assert (select count(*) = 1 from buykub.seller_pdf_preferences), 'own row is readable after writing it';
end $$;
reset role;

-- Months follow Asia/Bangkok, the timezone the dashboard reports in.
do $$ begin
  assert (select date_part('day', buykub.agent_month_start() at time zone 'Asia/Bangkok') = 1), 'month starts on the first';
  assert (select date_part('hour', buykub.agent_month_start() at time zone 'Asia/Bangkok') = 0), 'month starts at local midnight';
end $$;
rollback;
