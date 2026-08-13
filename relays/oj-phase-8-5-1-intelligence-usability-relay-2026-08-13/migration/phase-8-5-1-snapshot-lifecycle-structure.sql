begin;

do $$
begin
  if to_regclass('public.research_snapshot_lifecycle_events') is null then
    raise exception 'research snapshot lifecycle table is missing';
  end if;
  if not coalesce((select relrowsecurity from pg_class where oid = 'public.research_snapshot_lifecycle_events'::regclass), false) then
    raise exception 'research snapshot lifecycle RLS is not enabled';
  end if;
  if has_table_privilege('anon', 'public.research_snapshot_lifecycle_events', 'select') then
    raise exception 'anon must not read research snapshot lifecycle events';
  end if;
  if not has_table_privilege('authenticated', 'public.research_snapshot_lifecycle_events', 'select') then
    raise exception 'authenticated users need lifecycle select access through RLS';
  end if;
  if has_table_privilege('authenticated', 'public.research_snapshot_lifecycle_events', 'insert')
    or has_table_privilege('authenticated', 'public.research_snapshot_lifecycle_events', 'update')
    or has_table_privilege('authenticated', 'public.research_snapshot_lifecycle_events', 'delete') then
    raise exception 'authenticated users must mutate lifecycle state only through RPCs';
  end if;
  if has_table_privilege('authenticated', 'public.research_snapshots', 'update')
    or has_table_privilege('authenticated', 'public.research_snapshots', 'delete') then
    raise exception 'original research snapshots must remain immutable';
  end if;
  if to_regprocedure('public.remove_research_snapshot(uuid,text,text)') is null
    or to_regprocedure('public.restore_research_snapshot(uuid)') is null then
    raise exception 'snapshot lifecycle RPCs are missing';
  end if;
  if has_function_privilege('anon', 'public.remove_research_snapshot(uuid,text,text)', 'execute')
    or has_function_privilege('anon', 'public.restore_research_snapshot(uuid)', 'execute') then
    raise exception 'anon must not execute snapshot lifecycle RPCs';
  end if;
  if not has_function_privilege('authenticated', 'public.remove_research_snapshot(uuid,text,text)', 'execute')
    or not has_function_privilege('authenticated', 'public.restore_research_snapshot(uuid)', 'execute') then
    raise exception 'authenticated users need snapshot lifecycle RPC access';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'research_snapshot_lifecycle_events'
      and policyname = 'research_snapshot_lifecycle_owner_select'
  ) then
    raise exception 'snapshot lifecycle owner-select policy is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'research_snapshot_lifecycle_events'
      and column_name = 'event_order' and is_identity = 'YES'
  ) then
    raise exception 'monotonic lifecycle event order is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid in (
      'public.remove_research_snapshot(uuid,text,text)'::regprocedure,
      'public.restore_research_snapshot(uuid)'::regprocedure
    )
      and prosecdef
      and proconfig = array['search_path=""']::text[]
    group by prosecdef, proconfig
    having count(*) = 2
  ) then
    raise exception 'snapshot lifecycle RPCs must use a locked search path';
  end if;
end;
$$;

rollback;
