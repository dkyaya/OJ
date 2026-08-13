-- Run after 20260812224500_phase_8_5_catalyst_intelligence.sql.
begin;

do $test$
declare
  column_name text;
begin
  if to_regclass('public.catalyst_provider_cache') is null then
    raise exception 'provider cache missing';
  end if;

  foreach column_name in array array[
    'provider', 'source_quality', 'freshness', 'fetched_at', 'source_reference',
    'session_label', 'source_date', 'calendar_days_to_catalyst',
    'catalyst_timezone', 'catalyst_session'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'research_snapshots'
        and information_schema.columns.column_name = column_name
    ) then raise exception 'research_snapshots.% missing', column_name; end if;
  end loop;

  if (select relrowsecurity from pg_class where oid = 'public.catalyst_provider_cache'::regclass) is distinct from true then
    raise exception 'provider cache RLS disabled';
  end if;
  if has_table_privilege('anon', 'public.catalyst_provider_cache', 'select')
    or has_table_privilege('authenticated', 'public.catalyst_provider_cache', 'select')
    or has_table_privilege('authenticated', 'public.catalyst_provider_cache', 'insert') then
    raise exception 'browser roles can access provider cache';
  end if;
  if not has_table_privilege('service_role', 'public.catalyst_provider_cache', 'select')
    or not has_table_privilege('service_role', 'public.catalyst_provider_cache', 'insert') then
    raise exception 'service role provider-cache access missing';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'catalyst_provider_cache') then
    raise exception 'provider cache unexpectedly has browser-facing policies';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.catalyst_provider_cache'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like 'UNIQUE (user_id, cache_key)%'
  ) then raise exception 'per-user cache uniqueness missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'catalyst_provider_cache_expiry_idx'
  ) then raise exception 'cache expiry index missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'research_snapshots_catalyst_session_idx'
  ) then raise exception 'snapshot session index missing'; end if;
end
$test$;

select 'passed' as phase_8_5_catalyst_intelligence_structure;
rollback;
