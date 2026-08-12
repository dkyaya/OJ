-- Run after 20260812025054_catalyst_first_research_foundation.sql.
begin;

do $test$
declare
  table_name text;
  rls_enabled boolean;
  column_name text;
begin
  foreach table_name in array array['trade_idea_catalysts','research_sources','research_snapshots'] loop
    if to_regclass('public.' || table_name) is null then raise exception '% missing', table_name; end if;
    select relrowsecurity into rls_enabled from pg_class where oid = to_regclass('public.' || table_name);
    if rls_enabled is distinct from true then raise exception '% RLS disabled', table_name; end if;
    if has_table_privilege('anon', 'public.' || table_name, 'select') then raise exception 'anon can read %', table_name; end if;
  end loop;

  foreach column_name in array array[
    'schedule_kind','scheduled_date','scheduled_time','timezone_name','market_session',
    'date_certainty','event_status','source_quality','last_verified_at','consensus_value',
    'prior_value','actual_value','surprise_value','why_matters','key_variables',
    'cross_asset_reaction','rates_reaction','sector_reaction','post_event_interpretation','tags'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'catalysts' and columns.column_name = column_name
    ) then raise exception 'catalysts.% missing', column_name; end if;
  end loop;

  foreach column_name in array array[
    'research_stage','next_decision_at','earliest_entry_at','latest_entry_at',
    'exposure_tags','risk_overshoot_acknowledged','risk_overshoot_note'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'trade_ideas' and columns.column_name = column_name
    ) then raise exception 'trade_ideas.% missing', column_name; end if;
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
end
$test$;

select 'passed' as catalyst_first_research_structure;
rollback;

