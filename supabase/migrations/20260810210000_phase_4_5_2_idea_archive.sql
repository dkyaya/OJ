-- Phase 4.5.2: reversible idea archive plus separate permanent deletion.
-- Ordinary browser roles still have no table DELETE privilege. Archive changes
-- only deleted_at; the high-friction delete command handles research-only rows.

create or replace function private.guard_browser_draft_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.sync_status is distinct from 'cloud_draft'::public.oj_sync_status then raise exception 'browser writes may only produce cloud_draft state'; end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then raise exception 'browser revisions must increment exactly once'; end if;
    if tg_op = 'UPDATE'
      and new.deleted_at is distinct from old.deleted_at
      and coalesce(current_setting('oj.idea_archive_context', true), '') <> 'set_trade_idea_archived'
    then
      raise exception 'archive state is server-managed';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.guard_browser_draft_state() from public, anon, authenticated;

create or replace function private.guard_trade_idea_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if exists (
      select 1
      from public.trades trade
      where trade.trade_idea_id = old.id
        and trade.user_id = old.user_id
    ) or exists (
      select 1
      from public.trade_entries entry
      where entry.trade_idea_id = old.id
        and entry.user_id = old.user_id
        and entry.confirmed_actual
    ) then
      raise exception 'trade-backed ideas cannot be archived';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.guard_trade_idea_archive() from public, anon, authenticated;
drop trigger if exists guard_trade_idea_archive on public.trade_ideas;
create trigger guard_trade_idea_archive
  before update on public.trade_ideas
  for each row execute function private.guard_trade_idea_archive();

create or replace function public.set_trade_idea_archived(
  p_trade_idea_id uuid,
  p_expected_revision integer,
  p_archived boolean
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  idea public.trade_ideas%rowtype;
  next_revision integer;
begin
  if owner_id is null then
    raise exception 'approved authentication required';
  end if;
  if p_trade_idea_id is null or p_expected_revision is null or p_expected_revision < 1 or p_archived is null then
    raise exception 'invalid archive request';
  end if;

  select * into idea
  from public.trade_ideas
  where id = p_trade_idea_id and user_id = owner_id
  for update;

  if not found then raise exception 'trade idea not found'; end if;
  if idea.revision <> p_expected_revision then raise exception 'trade idea changed on another device'; end if;
  if p_archived and idea.deleted_at is not null then raise exception 'trade idea is already archived'; end if;
  if not p_archived and idea.deleted_at is null then raise exception 'trade idea is not archived'; end if;

  next_revision := idea.revision + 1;
  perform set_config('oj.idea_archive_context', 'set_trade_idea_archived', true);
  update public.trade_ideas
  set deleted_at = case when p_archived then now() else null end,
      revision = next_revision,
      updated_at = now()
  where id = idea.id
    and user_id = owner_id
    and revision = idea.revision;

  if not found then raise exception 'trade idea changed on another device'; end if;
  return next_revision;
end
$$;

revoke all on function public.set_trade_idea_archived(uuid, integer, boolean) from public, anon;
grant execute on function public.set_trade_idea_archived(uuid, integer, boolean) to authenticated;

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

drop policy if exists trade_entry_requests_owner_insert on public.trade_entry_requests;
create policy trade_entry_requests_owner_insert on public.trade_entry_requests for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (
      select 1 from public.trade_ideas parent
      where parent.id = trade_idea_id
        and parent.user_id = (select auth.uid())
        and parent.deleted_at is null
    )
  );

drop policy if exists trade_entries_owner_insert on public.trade_entries;
create policy trade_entries_owner_insert on public.trade_entries for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and (
      trade_idea_id is null
      or exists (
        select 1 from public.trade_ideas parent
        where parent.id = trade_idea_id
          and parent.user_id = (select auth.uid())
          and parent.deleted_at is null
      )
    )
  );

create or replace function private.process_trade_entry_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idea public.trade_ideas%rowtype;
  maximum_open_risk numeric;
  current_open_risk numeric;
  research_status text;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if not new.confirmed_actual then raise exception 'explicit entry confirmation required'; end if;

  select * into idea from public.trade_ideas where id = new.trade_idea_id and user_id = new.user_id for update;
  if not found then raise exception 'trade idea not found'; end if;
  if idea.deleted_at is not null then raise exception 'archived ideas cannot be entered'; end if;
  research_status := lower(coalesce(idea.data->>'Status', idea.data->>'status', 'watchlist'));
  if idea.entry_status <> 'not-entered' or idea.user_confirmed_fill then raise exception 'trade idea is not eligible for entry'; end if;
  if research_status in ('rejected','deferred','invalidated','draft') then raise exception 'trade idea must be watchlist or ready'; end if;

  select maximum_open_options_risk into maximum_open_risk from public.account_policies where user_id = new.user_id for update;
  if maximum_open_risk is null then raise exception 'account risk policy required'; end if;
  select coalesce(sum(max_risk), 0) into current_open_risk from public.trades where user_id = new.user_id and status = 'active' and deleted_at is null;
  if current_open_risk + new.max_risk > maximum_open_risk then raise exception 'entry exceeds maximum open options risk'; end if;

  insert into public.trades(id, user_id, trade_idea_id, ticker, strategy, status, contracts, max_risk, opened_at, confirmed_actual, data)
  values (new.id, new.user_id, idea.id, idea.ticker, idea.strategy, 'active', new.contracts, new.max_risk, new.opened_at, true, new.entry_data);
  insert into public.trade_entries(trade_idea_id, trade_id, user_id, data, confirmed_actual, record_status, revision, sync_status, source)
  values (idea.id, new.id, new.user_id, new.entry_data, true, 'confirmed', 1, 'cloud_draft', 'oj_app');
  update public.trade_ideas set entry_status = 'active', user_confirmed_fill = true, revision = revision + 1, updated_at = now()
  where id = idea.id and user_id = new.user_id and revision = idea.revision;
  if not found then raise exception 'trade idea revision conflict'; end if;
  return new;
end
$$;

revoke all on function private.process_trade_entry_request() from public, anon, authenticated;

create or replace function public.record_trade_entry(
  p_trade_idea_id uuid,
  p_contracts integer,
  p_opened_at timestamptz,
  p_max_risk numeric,
  p_entry_data jsonb,
  p_confirm_actual boolean
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  trade_id uuid := gen_random_uuid();
  archived_at timestamptz;
begin
  if owner_id is null then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit entry confirmation required'; end if;
  if p_contracts is null or p_contracts < 1 or p_opened_at is null or p_max_risk is null or p_max_risk <= 0 then raise exception 'invalid entry'; end if;
  if p_entry_data is null or jsonb_typeof(p_entry_data) <> 'object' then raise exception 'entry data must be an object'; end if;

  select deleted_at into archived_at
  from public.trade_ideas
  where id = p_trade_idea_id and user_id = owner_id;
  if found and archived_at is not null then raise exception 'archived ideas cannot be entered'; end if;

  insert into public.trade_entry_requests(id, user_id, trade_idea_id, contracts, opened_at, max_risk, entry_data, confirmed_actual)
  values (trade_id, owner_id, p_trade_idea_id, p_contracts, p_opened_at, p_max_risk, p_entry_data, true);
  return trade_id;
end
$$;

revoke all on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) from public, anon;
grant execute on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) to authenticated;

comment on function public.set_trade_idea_archived(uuid, integer, boolean) is
  'Owner-scoped, revision-checked soft archive and restore for research-only trade ideas.';
comment on function public.delete_trade_idea(uuid, integer, text) is
  'Owner-scoped permanent deletion command for archived, research-only trade ideas.';
comment on table public.trade_idea_deletion_tombstones is
  'Content-free deletion markers that prevent stale devices from recreating permanently deleted idea UUIDs.';
