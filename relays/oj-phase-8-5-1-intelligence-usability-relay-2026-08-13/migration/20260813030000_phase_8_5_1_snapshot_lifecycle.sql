begin;

alter table public.research_snapshots
  add constraint research_snapshots_id_user_unique unique (id, user_id);

create table public.research_snapshot_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  event_order bigint generated always as identity unique,
  snapshot_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('remove', 'restore')),
  reason text check (reason in (
    'test_snapshot',
    'data_entry_error',
    'wrong_expiration',
    'duplicate',
    'wrong_ticker',
    'bad_source_data',
    'other'
  )),
  note text check (note is null or (length(btrim(note)) between 1 and 500)),
  created_at timestamptz not null default now(),
  constraint research_snapshot_lifecycle_snapshot_owner_fkey
    foreign key (snapshot_id, user_id)
    references public.research_snapshots(id, user_id)
    on delete cascade,
  constraint research_snapshot_lifecycle_action_payload_check
    check (
      (action = 'remove' and reason is not null)
      or (action = 'restore' and reason is null and note is null)
    )
);

comment on table public.research_snapshot_lifecycle_events is
  'Append-only removal and restoration events for immutable user-owned research snapshots.';
comment on column public.research_snapshot_lifecycle_events.reason is
  'Required removal reason; restoration events intentionally have no reason or note.';

create index research_snapshot_lifecycle_user_snapshot_created_idx
  on public.research_snapshot_lifecycle_events(user_id, snapshot_id, event_order desc);

alter table public.research_snapshot_lifecycle_events enable row level security;

revoke all on public.research_snapshot_lifecycle_events from public, anon, authenticated;
grant select on public.research_snapshot_lifecycle_events to authenticated;
grant select, insert, update, delete on public.research_snapshot_lifecycle_events to service_role;
revoke all on sequence public.research_snapshot_lifecycle_events_event_order_seq from public, anon, authenticated;
grant usage, select on sequence public.research_snapshot_lifecycle_events_event_order_seq to service_role;

create policy research_snapshot_lifecycle_owner_select
on public.research_snapshot_lifecycle_events
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_approved_user())
  and exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.account_status = 'active'
  )
);

create or replace function public.remove_research_snapshot(
  p_snapshot_id uuid,
  p_reason text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  latest_event public.research_snapshot_lifecycle_events%rowtype;
  lifecycle_id uuid;
begin
  if actor_id is null
    or not (select private.is_approved_user())
    or not exists (
      select 1 from public.profiles profile
      where profile.id = actor_id and profile.account_status = 'active'
    )
  then
    raise exception 'approved_account_required';
  end if;

  if p_reason is null or p_reason not in (
    'test_snapshot', 'data_entry_error', 'wrong_expiration', 'duplicate',
    'wrong_ticker', 'bad_source_data', 'other'
  ) then
    raise exception 'invalid_removal_reason';
  end if;

  if p_note is not null and length(btrim(p_note)) > 500 then
    raise exception 'removal_note_too_long';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_snapshot_id::text, 0));

  if not exists (
    select 1 from public.research_snapshots snapshot
    where snapshot.id = p_snapshot_id and snapshot.user_id = actor_id
  ) then
    raise exception 'snapshot_not_found';
  end if;

  select event.* into latest_event
  from public.research_snapshot_lifecycle_events event
  where event.snapshot_id = p_snapshot_id and event.user_id = actor_id
  order by event.event_order desc
  limit 1;

  if latest_event.action = 'remove' then
    return latest_event.id;
  end if;

  insert into public.research_snapshot_lifecycle_events(snapshot_id, user_id, action, reason, note)
  values (p_snapshot_id, actor_id, 'remove', p_reason, nullif(btrim(p_note), ''))
  returning id into lifecycle_id;

  return lifecycle_id;
end;
$$;

create or replace function public.restore_research_snapshot(p_snapshot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  latest_event public.research_snapshot_lifecycle_events%rowtype;
  lifecycle_id uuid;
begin
  if actor_id is null
    or not (select private.is_approved_user())
    or not exists (
      select 1 from public.profiles profile
      where profile.id = actor_id and profile.account_status = 'active'
    )
  then
    raise exception 'approved_account_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_snapshot_id::text, 0));

  if not exists (
    select 1 from public.research_snapshots snapshot
    where snapshot.id = p_snapshot_id and snapshot.user_id = actor_id
  ) then
    raise exception 'snapshot_not_found';
  end if;

  select event.* into latest_event
  from public.research_snapshot_lifecycle_events event
  where event.snapshot_id = p_snapshot_id and event.user_id = actor_id
  order by event.event_order desc
  limit 1;

  if latest_event.id is null then
    raise exception 'snapshot_not_removed';
  end if;

  if latest_event.action = 'restore' then
    return latest_event.id;
  end if;

  insert into public.research_snapshot_lifecycle_events(snapshot_id, user_id, action)
  values (p_snapshot_id, actor_id, 'restore')
  returning id into lifecycle_id;

  return lifecycle_id;
end;
$$;

revoke all on function public.remove_research_snapshot(uuid, text, text) from public, anon, authenticated;
revoke all on function public.restore_research_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.remove_research_snapshot(uuid, text, text) to authenticated;
grant execute on function public.restore_research_snapshot(uuid) to authenticated;
grant execute on function public.remove_research_snapshot(uuid, text, text) to service_role;
grant execute on function public.restore_research_snapshot(uuid) to service_role;

commit;
