-- Portable structural security test. It does not require pgTAP and rolls back.
begin;

do $test$
declare
  idea_policies text[];
  activation_is_definer boolean;
  activation_config text[];
begin
  if to_regclass('public.trade_ideas') is null then raise exception 'trade_ideas missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trade_ideas' and column_name='user_id'
  ) then raise exception 'trade_ideas ownership column missing'; end if;

  select array_agg(policyname order by policyname) into idea_policies
  from pg_policies where schemaname='public' and tablename='trade_ideas';
  if idea_policies is distinct from array['trade_ideas_owner_insert','trade_ideas_owner_select','trade_ideas_owner_update']::text[] then
    raise exception 'trade_ideas owner policies changed';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.trade_ideas'::regclass) then raise exception 'trade_ideas RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.formalization_payloads'::regclass) then raise exception 'formalization_payloads RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.formalization_jobs'::regclass) then raise exception 'formalization_jobs RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.account_invites'::regclass) then raise exception 'account_invites RLS disabled'; end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='is_approved_user' and n.nspname='private') then raise exception 'private allowlist helper missing'; end if;
  if has_function_privilege('anon','private.is_approved_user()','execute') then raise exception 'anon can execute allowlist helper'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and policyname like '%_delete') then raise exception 'browser delete policy exists'; end if;
  if not exists (select 1 from pg_trigger where tgname='guard_profile_privileges' and tgrelid='public.profiles'::regclass) then raise exception 'profile privilege guard missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='guard_browser_draft_state' and tgrelid='public.trade_ideas'::regclass) then raise exception 'browser draft-state guard missing'; end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='account_invites') then raise exception 'account_invites browser policy exists'; end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='account_invites' and grantee in ('anon','authenticated')
  ) then raise exception 'browser role has account_invites grant'; end if;

  select p.prosecdef, p.proconfig into activation_is_definer, activation_config
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='activate_invited_account' and pg_get_function_identity_arguments(p.oid)='';
  if activation_is_definer is distinct from true then raise exception 'activation RPC is not security definer'; end if;
  if activation_config is distinct from array['search_path=""']::text[] then raise exception 'activation RPC search path is not empty'; end if;
  if has_function_privilege('anon','public.activate_invited_account()','execute') then raise exception 'anon can execute activation RPC'; end if;
  if not has_function_privilege('authenticated','public.activate_invited_account()','execute') then raise exception 'authenticated cannot execute activation RPC'; end if;
end
$test$;

select 'passed' as rls_structure_and_invite_privacy;
rollback;
