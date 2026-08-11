create or replace function private.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.id is distinct from old.id or new.approved is distinct from old.approved then
      raise exception 'profile privilege fields are server-managed';
    end if;
  end if;
  return new;
end
$$;

create or replace function private.guard_trade_idea_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.user_id is distinct from old.user_id
      or new.published_record_id is distinct from old.published_record_id
      or new.published_commit_sha is distinct from old.published_commit_sha
      or new.published_note_path is distinct from old.published_note_path
      or new.last_submitted_at is distinct from old.last_submitted_at
      or new.last_published_at is distinct from old.last_published_at then
      raise exception 'ownership and publication fields are server-managed';
    end if;
  end if;
  return new;
end
$$;

create or replace function private.guard_owned_record_user_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and new.user_id is distinct from old.user_id then
    raise exception 'record ownership is immutable';
  end if;
  return new;
end
$$;

revoke all on function private.guard_profile_privileges() from public, anon, authenticated;
revoke all on function private.guard_trade_idea_privileges() from public, anon, authenticated;
revoke all on function private.guard_owned_record_user_id() from public, anon, authenticated;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
before update on public.profiles
for each row execute function private.guard_profile_privileges();

drop trigger if exists guard_trade_idea_privileges on public.trade_ideas;
create trigger guard_trade_idea_privileges
before update on public.trade_ideas
for each row execute function private.guard_trade_idea_privileges();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trade_candidates',
    'catalysts',
    'research_annotations',
    'trade_entries',
    'trade_checkins',
    'trade_exits',
    'journal_reviews'
  ] loop
    execute format('drop trigger if exists guard_owned_record_user_id on public.%I', table_name);
    execute format(
      'create trigger guard_owned_record_user_id before update on public.%I for each row execute function private.guard_owned_record_user_id()',
      table_name
    );
  end loop;
end
$$;
