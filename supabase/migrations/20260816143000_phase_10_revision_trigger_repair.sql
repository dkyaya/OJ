-- Keep the shared Idea/Candidate revision guard valid for both row shapes.

begin;

create or replace function private.reject_revision_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'trade_ideas'
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
     and coalesce(current_setting('oj.idea_archive_context', true), '') <> 'set_trade_idea_archived'
     and (to_jsonb(old)->>'deleted_at') is not null then
    raise exception 'restore the archived idea before editing it';
  end if;
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and (to_jsonb(new) - 'revision' - 'updated_at') = (to_jsonb(old) - 'revision' - 'updated_at') then
    raise exception 'no changes to save';
  end if;
  return new;
end
$$;

revoke all on function private.reject_revision_only_update() from public, anon, authenticated;

comment on function private.reject_revision_only_update() is
  'Rejects browser no-op revision updates and archived Idea edits, preserves the protected archive/restore RPC, and avoids reading Trade-Idea-only fields from Candidate rows.';

commit;
