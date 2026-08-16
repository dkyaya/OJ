-- Run after 20260812025054_catalyst_first_research_foundation.sql.
begin;

do $test$
declare
  expected_table text;
  rls_enabled boolean;
  expected_column text;
begin
  foreach expected_table in array array['trade_idea_catalysts','research_sources','research_snapshots'] loop
    if to_regclass('public.' || expected_table) is null then raise exception '% missing', expected_table; end if;
    select relrowsecurity into rls_enabled from pg_class where oid = to_regclass('public.' || expected_table);
    if rls_enabled is distinct from true then raise exception '% RLS disabled', expected_table; end if;
    if has_table_privilege('anon', 'public.' || expected_table, 'select') then raise exception 'anon can read %', expected_table; end if;
  end loop;

  foreach expected_column in array array[
    'schedule_kind','scheduled_date','scheduled_time','timezone_name','market_session',
    'date_certainty','event_status','source_quality','last_verified_at','consensus_value',
    'prior_value','actual_value','surprise_value','why_matters','key_variables',
    'cross_asset_reaction','rates_reaction','sector_reaction','post_event_interpretation','tags'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where columns.table_schema = 'public' and columns.table_name = 'catalysts' and columns.column_name = expected_column
    ) then raise exception 'catalysts.% missing', expected_column; end if;
  end loop;

  foreach expected_column in array array[
    'research_stage','next_decision_at','earliest_entry_at','latest_entry_at',
    'exposure_tags','risk_overshoot_acknowledged','risk_overshoot_note'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where columns.table_schema = 'public' and columns.table_name = 'trade_ideas' and columns.column_name = expected_column
    ) then raise exception 'trade_ideas.% missing', expected_column; end if;
  end loop;

  if has_table_privilege('authenticated','public.research_snapshots','update') then
    raise exception 'append-only research snapshots are browser-mutable';
  end if;
  if has_table_privilege('authenticated','public.research_snapshots','delete') then
    raise exception 'append-only research snapshots are browser-deletable';
  end if;
  if has_table_privilege('authenticated','public.research_snapshots','insert') is distinct from true then
    raise exception 'authenticated users cannot append research snapshots';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and tablename = 'research_snapshots'
      and indexname = 'research_snapshots_user_observed_idx'
  ) then raise exception 'snapshot owner/time index missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and tablename = 'trade_ideas'
      and indexname = 'trade_ideas_exposure_tags_idx'
  ) then raise exception 'Idea exposure GIN index missing'; end if;

  if position(
    'current_user in (''service_role'', ''postgres'', ''supabase_admin'')'
    in pg_get_functiondef('private.guard_catalyst_scope()'::regprocedure)
  ) = 0 then
    raise exception 'catalyst scope guard blocks trusted migration maintenance';
  end if;
end
$test$;

-- The migration runner connects as postgres without an end-user JWT. Exercise
-- that exact maintenance path so catalyst backfills cannot regress into an
-- approved-authentication failure.
insert into auth.users(id,email,email_confirmed_at,encrypted_password)
values (
  '60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  'catalyst-maintenance@example.invalid',
  now(),
  encode(gen_random_bytes(32),'hex')
);
insert into public.catalysts(
  id,user_id,event,event_type,event_at,created_by,updated_by,visibility,data
)
values (
  '60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0',
  '60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  'Synthetic migration maintenance catalyst',
  'Other',
  now() + interval '1 day',
  '60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  '60aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0',
  'private',
  '{}'
);
update public.catalysts
set scheduled_date = (event_at at time zone timezone_name)::date,
    scheduled_time = (event_at at time zone timezone_name)::time
where id = '60bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0';

select 'passed' as catalyst_first_research_structure;
rollback;
