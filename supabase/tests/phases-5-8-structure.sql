-- Run after the Phase 5-8 migrations. Structural checks only; every statement rolls back.
begin;

do $test$
declare table_name text; rls_enabled boolean; private_grants integer;
begin
  foreach table_name in array array[
    'workspaces','workspace_members','workspace_invites','evidence_cards','evidence_responses',
    'shared_theses','shared_thesis_responses','thesis_forks','activity_events','research_missions',
    'mission_assignments','research_questions','options_liquidity_observations','mission_checkpoints',
    'personal_forecasts','forecast_revisions','mission_debriefs'
  ] loop
    if to_regclass('public.' || table_name) is null then raise exception '% missing', table_name; end if;
    select relrowsecurity into rls_enabled from pg_class where oid=to_regclass('public.' || table_name);
    if rls_enabled is distinct from true then raise exception '% RLS disabled', table_name; end if;
  end loop;

  if has_table_privilege('authenticated','public.workspace_invites','select') then raise exception 'workspace invites are browser-enumerable'; end if;
  if has_table_privilege('authenticated','public.activity_events','insert') then raise exception 'activity events are browser-writable'; end if;
  if has_table_privilege('authenticated','public.personal_forecasts','insert') then raise exception 'forecast snapshots can bypass server RPC'; end if;
  if has_table_privilege('authenticated','public.forecast_revisions','update') then raise exception 'forecast revisions are browser-mutable'; end if;
  if has_table_privilege('authenticated','public.trade_ideas','select') is distinct from true then raise exception 'private Ideas compatibility changed'; end if;

  select count(*) into private_grants
  from information_schema.role_routine_grants
  where specific_schema='private' and grantee in ('anon','authenticated')
    and routine_name in ('add_workspace_activity','guard_forecast_core','guard_debrief_author');
  if private_grants <> 0 then raise exception 'browser can execute private collaboration helpers'; end if;

  if not has_function_privilege('authenticated','public.accept_workspace_invite(uuid)','execute') then raise exception 'workspace acceptance RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.fork_shared_thesis(uuid)','execute') then raise exception 'private thesis fork RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.complete_research_mission(uuid,text)','execute') then raise exception 'mission completion RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.lock_personal_forecast(uuid,integer)','execute') then raise exception 'forecast lock RPC unavailable'; end if;

  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='workspace_invites'
  ) then raise exception 'workspace invitation table has a browser policy'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='workspace_members'
      and indexname='workspace_members_user_active_idx'
  ) then raise exception 'workspace membership lookup index missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='personal_forecasts'
      and indexname='personal_forecasts_workspace_catalyst_idx'
  ) then raise exception 'forecast workspace/catalyst index missing'; end if;
end
$test$;

select 'passed' as phases_5_8_structure_and_privileges;
rollback;
