-- Phase 4.5.2 follow-up: permanent deletion remains distinct from reversible archive.
-- Direct browser table DELETE privileges remain disabled.

-- Permanent deletion is a separate, high-friction command. The browser can
-- insert a request but still has no DELETE grant on canonical or child tables.
-- A content-free tombstone prevents a stale device from recreating the same
-- canonical UUID after deletion.
create table public.trade_idea_deletion_tombstones (
  trade_idea_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

alter table public.trade_idea_deletion_tombstones enable row level security;
revoke all on table public.trade_idea_deletion_tombstones from anon, authenticated;

create or replace function private.guard_deleted_trade_idea_recreation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.trade_idea_deletion_tombstones tombstone
    where tombstone.trade_idea_id=new.id and tombstone.user_id=new.user_id
  ) then
    raise exception 'permanently deleted trade idea cannot be recreated';
  end if;
  return new;
end
$$;

revoke all on function private.guard_deleted_trade_idea_recreation() from public, anon, authenticated;
create trigger guard_deleted_trade_idea_recreation
  before insert on public.trade_ideas
  for each row execute function private.guard_deleted_trade_idea_recreation();

create table public.trade_idea_deletion_requests (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_idea_id uuid not null,
  expected_revision integer not null check (expected_revision > 0),
  confirmation text not null check (length(confirmation) between 8 and 40),
  created_at timestamptz not null default now()
);

alter table public.trade_idea_deletion_requests enable row level security;
revoke all on table public.trade_idea_deletion_requests from anon, authenticated;
grant insert on table public.trade_idea_deletion_requests to authenticated;
create policy trade_idea_deletion_requests_owner_insert on public.trade_idea_deletion_requests for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (
      select 1 from public.trade_ideas parent
      where parent.id = trade_idea_id
        and parent.user_id = (select auth.uid())
    )
  );

create or replace function private.process_trade_idea_deletion_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idea public.trade_ideas%rowtype;
begin
  if (select auth.uid()) is null
    or new.user_id <> (select auth.uid())
    or not (select private.is_approved_user())
  then
    raise exception 'approved authentication required';
  end if;

  select * into idea
  from public.trade_ideas
  where id = new.trade_idea_id and user_id = new.user_id
  for update;

  if not found then raise exception 'trade idea not found'; end if;
  if idea.revision <> new.expected_revision then raise exception 'trade idea changed on another device'; end if;
  if idea.deleted_at is null then raise exception 'archive the idea before deleting it'; end if;
  if new.confirmation <> 'DELETE ' || idea.ticker then raise exception 'delete confirmation did not match'; end if;

  if exists (select 1 from public.trades item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
    or exists (select 1 from public.trade_entries item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
    or exists (select 1 from public.trade_checkins item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
    or exists (select 1 from public.trade_exits item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
    or exists (select 1 from public.journal_reviews item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
    or exists (select 1 from public.trade_entry_requests item where item.trade_idea_id=idea.id and item.user_id=idea.user_id)
  then
    raise exception 'ideas with trade or journal history cannot be deleted';
  end if;

  insert into public.trade_idea_deletion_tombstones(trade_idea_id,user_id)
  values (idea.id,idea.user_id);

  delete from public.record_revisions revision
  where revision.user_id=idea.user_id and (
    (revision.record_type='trade_candidates' and revision.record_id in (select id from public.trade_candidates where trade_idea_id=idea.id and user_id=idea.user_id))
    or (revision.record_type='research_annotations' and revision.record_id in (select id from public.research_annotations where trade_idea_id=idea.id and user_id=idea.user_id))
    or (revision.record_type='catalyst_security_mappings' and revision.record_id in (select id from public.catalyst_security_mappings where trade_idea_id=idea.id and user_id=idea.user_id))
  );

  update public.catalysts
  set trade_idea_id=null, revision=revision+1, updated_at=now()
  where trade_idea_id=idea.id and user_id=idea.user_id;

  delete from public.catalyst_security_mappings where trade_idea_id=idea.id and user_id=idea.user_id;
  delete from public.research_annotations where trade_idea_id=idea.id and user_id=idea.user_id;
  delete from public.trade_candidates where trade_idea_id=idea.id and user_id=idea.user_id;

  delete from public.formalization_payloads payload
  using public.formalization_jobs job
  where payload.job_id=job.id and payload.user_id=idea.user_id
    and job.user_id=idea.user_id and job.record_id=idea.id
    and job.record_type in ('trade_idea','trade_ideas');
  delete from public.formalization_jobs
  where user_id=idea.user_id and record_id=idea.id and record_type in ('trade_idea','trade_ideas');
  delete from public.published_records
  where user_id=idea.user_id and record_id=idea.id and record_type in ('trade_idea','trade_ideas');
  delete from public.sync_events
  where user_id=idea.user_id and record_id=idea.id and record_type in ('trade_idea','trade_ideas');
  delete from public.migration_registry
  where user_id=idea.user_id and record_id=idea.id and record_type in ('trade_idea','trade_ideas');
  delete from public.record_revisions
  where user_id=idea.user_id and record_id=idea.id and record_type='trade_ideas';

  delete from public.trade_ideas where id=idea.id and user_id=idea.user_id;
  delete from public.trade_idea_deletion_requests where id=new.id;
  return new;
end
$$;

revoke all on function private.process_trade_idea_deletion_request() from public, anon, authenticated;
create trigger process_trade_idea_deletion_request
  after insert on public.trade_idea_deletion_requests
  for each row execute function private.process_trade_idea_deletion_request();

create or replace function public.delete_trade_idea(
  p_trade_idea_id uuid,
  p_expected_revision integer,
  p_confirmation text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  request_id uuid := gen_random_uuid();
begin
  if owner_id is null then raise exception 'approved authentication required'; end if;
  if p_trade_idea_id is null or p_expected_revision is null or p_expected_revision < 1 or p_confirmation is null then
    raise exception 'invalid delete request';
  end if;
  insert into public.trade_idea_deletion_requests(id,user_id,trade_idea_id,expected_revision,confirmation)
  values (request_id,owner_id,p_trade_idea_id,p_expected_revision,p_confirmation);
  return request_id;
end
$$;

revoke all on function public.delete_trade_idea(uuid, integer, text) from public, anon;
grant execute on function public.delete_trade_idea(uuid, integer, text) to authenticated;

comment on function public.delete_trade_idea(uuid, integer, text) is
  'Owner-scoped permanent deletion command for archived, research-only trade ideas.';
comment on table public.trade_idea_deletion_tombstones is
  'Content-free deletion markers that prevent stale devices from recreating permanently deleted idea UUIDs.';
