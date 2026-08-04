create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.is_approved_user() set schema private;
revoke all on function private.is_approved_user() from public, anon;
grant execute on function private.is_approved_user() to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trade_ideas',
    'trade_candidates',
    'catalysts',
    'research_annotations',
    'trade_entries',
    'trade_checkins',
    'trade_exits',
    'journal_reviews'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for select using ((select auth.uid()) = user_id and (select private.is_approved_user()))',
      table_name || '_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check ((select auth.uid()) = user_id and (select private.is_approved_user()))',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update using ((select auth.uid()) = user_id and (select private.is_approved_user())) with check ((select auth.uid()) = user_id and (select private.is_approved_user()))',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete using ((select auth.uid()) = user_id and (select private.is_approved_user()))',
      table_name || '_delete', table_name
    );
  end loop;
end
$$;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_select on public.profiles for select using ((select auth.uid()) = id);
create policy profiles_self_update on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists jobs_owner_select on public.formalization_jobs;
drop policy if exists payloads_owner_select on public.formalization_payloads;
drop policy if exists events_owner_select on public.sync_events;
drop policy if exists published_owner_select on public.published_records;
create policy jobs_owner_select on public.formalization_jobs for select using ((select auth.uid()) = user_id and (select private.is_approved_user()));
create policy payloads_owner_select on public.formalization_payloads for select using ((select auth.uid()) = user_id and (select private.is_approved_user()));
create policy events_owner_select on public.sync_events for select using ((select auth.uid()) = user_id and (select private.is_approved_user()));
create policy published_owner_select on public.published_records for select using ((select auth.uid()) = user_id and (select private.is_approved_user()));

create index if not exists trade_candidates_trade_idea_id_idx on public.trade_candidates(trade_idea_id);
create index if not exists trade_candidates_user_id_idx on public.trade_candidates(user_id);
create index if not exists catalysts_trade_idea_id_idx on public.catalysts(trade_idea_id);
create index if not exists research_annotations_trade_idea_id_idx on public.research_annotations(trade_idea_id);
create index if not exists trade_entries_trade_idea_id_idx on public.trade_entries(trade_idea_id);
create index if not exists trade_entries_user_id_idx on public.trade_entries(user_id);
create index if not exists trade_checkins_trade_idea_id_idx on public.trade_checkins(trade_idea_id);
create index if not exists trade_checkins_user_id_idx on public.trade_checkins(user_id);
create index if not exists trade_exits_trade_idea_id_idx on public.trade_exits(trade_idea_id);
create index if not exists trade_exits_user_id_idx on public.trade_exits(user_id);
create index if not exists journal_reviews_trade_idea_id_idx on public.journal_reviews(trade_idea_id);
create index if not exists journal_reviews_user_id_idx on public.journal_reviews(user_id);
create index if not exists formalization_payloads_user_id_idx on public.formalization_payloads(user_id);
create index if not exists published_records_user_id_idx on public.published_records(user_id);
