create or replace function private.guard_browser_draft_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.sync_status is distinct from 'cloud_draft'::public.oj_sync_status then
      raise exception 'browser writes may only produce cloud_draft state';
    end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then
      raise exception 'browser revisions must increment exactly once';
    end if;
    if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at then
      raise exception 'deletion state is server-managed';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.guard_browser_draft_state() from public, anon, authenticated;

create or replace function private.guard_browser_revision_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.sync_status is distinct from 'cloud_draft'::public.oj_sync_status then
      raise exception 'browser writes may only produce cloud_draft state';
    end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then
      raise exception 'browser revisions must increment exactly once';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.guard_browser_revision_state() from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trade_ideas',
    'catalysts',
    'research_annotations'
  ] loop
    execute format('drop trigger if exists guard_browser_draft_state on public.%I', table_name);
    execute format(
      'create trigger guard_browser_draft_state before insert or update on public.%I for each row execute function private.guard_browser_draft_state()',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'trade_entries',
    'trade_checkins',
    'trade_exits',
    'journal_reviews'
  ] loop
    execute format('drop trigger if exists guard_browser_revision_state on public.%I', table_name);
    execute format(
      'create trigger guard_browser_revision_state before insert or update on public.%I for each row execute function private.guard_browser_revision_state()',
      table_name
    );
  end loop;

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
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
  end loop;

  foreach table_name in array array[
    'profiles',
    'trade_ideas',
    'trade_candidates',
    'catalysts',
    'research_annotations',
    'trade_entries',
    'trade_checkins',
    'trade_exits',
    'journal_reviews',
    'formalization_jobs'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end
$$;
