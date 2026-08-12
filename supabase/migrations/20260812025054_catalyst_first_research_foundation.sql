-- Catalyst-first research foundation.
-- Extends the existing Phase 5-8 objects; it does not create a competing
-- calendar, Idea, candidate, mission, evidence, forecast, or trade system.

begin;

-- Phase 5 originally treated every catalyst write as an authenticated browser
-- write. Trusted database maintenance runs without an end-user JWT, so that
-- guard also blocked this migration's catalyst backfills. Preserve all browser
-- and workspace checks while allowing the same privileged database roles used
-- by OJ's other ownership and browser-state guards to perform maintenance.
create or replace function private.guard_catalyst_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if (select auth.uid()) is null or not (select private.is_approved_user()) then
    raise exception 'approved authentication required';
  end if;
  if tg_op = 'INSERT' then
    if new.user_id <> (select auth.uid()) or new.created_by <> (select auth.uid()) or new.updated_by <> (select auth.uid()) then
      raise exception 'catalyst authorship must match the current user';
    end if;
  else
    if new.user_id is distinct from old.user_id
      or new.created_by is distinct from old.created_by
      or new.workspace_id is distinct from old.workspace_id
    then
      raise exception 'catalyst ownership and workspace scope are immutable';
    end if;
    if new.updated_by <> (select auth.uid()) then raise exception 'catalyst updater must match the current user'; end if;
  end if;
  if new.visibility = 'workspace' then
    if new.workspace_id is null or not (select private.is_workspace_member(new.workspace_id)) then
      raise exception 'active workspace membership required';
    end if;
  elsif new.user_id <> (select auth.uid()) then
    raise exception 'private catalysts belong to their creator';
  end if;
  return new;
end
$$;

revoke all on function private.guard_catalyst_scope() from public, anon, authenticated;

alter table public.catalysts
  add column schedule_kind text not null default 'scheduled'
    check (schedule_kind in ('scheduled', 'contextual')),
  add column scheduled_date date,
  add column scheduled_time time,
  add column timezone_name text not null default 'America/New_York'
    check (char_length(btrim(timezone_name)) between 1 and 80),
  add column market_session text not null default 'all_day'
    check (market_session in ('pre_market', 'regular', 'after_hours', 'all_day', 'unscheduled')),
  add column date_certainty text not null default 'unconfirmed'
    check (date_certainty in ('confirmed', 'estimated', 'unconfirmed', 'contextual')),
  add column event_status text not null default 'scheduled'
    check (event_status in ('scheduled', 'released', 'revised', 'cancelled', 'contextual')),
  add column source_url text check (source_url is null or source_url ~* '^https?://'),
  add column source_quality text not null default 'unverified'
    check (source_quality in ('official', 'primary', 'secondary', 'unverified')),
  add column last_verified_at timestamptz,
  add column consensus_value text,
  add column prior_value text,
  add column actual_value text,
  add column surprise_value text,
  add column why_matters text,
  add column key_variables text[] not null default '{}',
  add column transmission_path text,
  add column cross_asset_reaction text,
  add column rates_reaction text,
  add column sector_reaction text,
  add column post_event_interpretation text,
  add column tags text[] not null default '{}';

update public.catalysts
set scheduled_date = (event_at at time zone timezone_name)::date,
    scheduled_time = (event_at at time zone timezone_name)::time
where event_at is not null;

alter table public.trade_ideas
  add column research_stage text not null default 'watching'
    check (research_stage in (
      'watching', 'researching', 'thesis_forming', 'entry_candidate',
      'entered', 'exited', 'reviewed', 'parked', 'rejected', 'no_trade'
    )),
  add column next_decision_at timestamptz,
  add column earliest_entry_at timestamptz,
  add column latest_entry_at timestamptz,
  add column exposure_tags text[] not null default '{}',
  add column risk_overshoot_acknowledged boolean not null default false,
  add column risk_overshoot_note text;

-- Preserve rich records saved during a Pages-before-database deployment gap.
-- The compatibility client stores the new fields in the existing data object.
update public.catalysts
set schedule_kind = case when data->>'schedule_kind' in ('scheduled','contextual') then data->>'schedule_kind' else schedule_kind end,
    scheduled_date = case when data->>'scheduled_date' ~ '^\d{4}-\d{2}-\d{2}$' then (data->>'scheduled_date')::date else scheduled_date end,
    scheduled_time = case when data->>'scheduled_time' ~ '^\d{2}:\d{2}' then (data->>'scheduled_time')::time else scheduled_time end,
    timezone_name = case when char_length(btrim(data->>'timezone_name')) between 1 and 80 then data->>'timezone_name' else timezone_name end,
    market_session = case when data->>'market_session' in ('pre_market','regular','after_hours','all_day','unscheduled') then data->>'market_session' else market_session end,
    date_certainty = case when data->>'date_certainty' in ('confirmed','estimated','unconfirmed','contextual') then data->>'date_certainty' else date_certainty end,
    event_status = case when data->>'schedule_kind' = 'contextual' then 'contextual' else event_status end,
    source_url = nullif(btrim(data->>'source_url'), ''),
    source_quality = case when data->>'source_quality' in ('official','primary','secondary','unverified') then data->>'source_quality' else source_quality end,
    consensus_value = nullif(btrim(data->>'consensus_value'), ''),
    prior_value = nullif(btrim(data->>'prior_value'), ''),
    why_matters = nullif(btrim(data->>'why_matters'), ''),
    key_variables = case when jsonb_typeof(data->'key_variables') = 'array' then array(select jsonb_array_elements_text(data->'key_variables')) else key_variables end,
    tags = case when jsonb_typeof(data->'tags') = 'array' then array(select jsonb_array_elements_text(data->'tags')) else tags end
where data ? 'schedule_kind';

alter table public.trade_ideas
  add constraint trade_ideas_entry_window_order
    check (earliest_entry_at is null or latest_entry_at is null or earliest_entry_at <= latest_entry_at),
  add constraint trade_ideas_risk_overshoot_note
    check (not risk_overshoot_acknowledged or char_length(btrim(coalesce(risk_overshoot_note, ''))) > 0);

create table public.trade_idea_catalysts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_idea_id uuid not null,
  catalyst_id uuid not null references public.catalysts(id) on delete restrict,
  relationship text not null default 'primary'
    check (relationship in ('primary', 'supporting', 'avoid', 'exit', 'context')),
  created_at timestamptz not null default now(),
  constraint trade_idea_catalysts_idea_owner_fkey
    foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete cascade,
  unique (trade_idea_id, catalyst_id, relationship)
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalyst_id uuid references public.catalysts(id) on delete cascade,
  trade_idea_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  publisher text check (publisher is null or char_length(btrim(publisher)) <= 160),
  url text not null check (char_length(btrim(url)) between 1 and 2000 and url ~* '^https?://'),
  source_quality text not null default 'secondary'
    check (source_quality in ('official', 'primary', 'secondary', 'unverified')),
  claim_summary text check (claim_summary is null or char_length(btrim(claim_summary)) <= 4000),
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_sources_target_check
    check (num_nonnulls(catalyst_id, trade_idea_id) >= 1),
  constraint research_sources_idea_owner_fkey
    foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete cascade
);

create table public.research_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalyst_id uuid references public.catalysts(id) on delete cascade,
  trade_idea_id uuid,
  source_id uuid references public.research_sources(id) on delete set null,
  snapshot_type text not null check (snapshot_type in (
    'market_pricing', 'event_implied_move', 'expiration_implied_move',
    'entry_window', 'event_reaction', 'realized_event_move', 'macro_context'
  )),
  ticker text check (ticker is null or ticker ~ '^[A-Z0-9._-]{1,20}$'),
  observed_at timestamptz not null,
  methodology text not null check (char_length(btrim(methodology)) between 1 and 2000),
  values jsonb not null default '{}'::jsonb check (jsonb_typeof(values) = 'object'),
  created_at timestamptz not null default now(),
  constraint research_snapshots_target_check
    check (num_nonnulls(catalyst_id, trade_idea_id) >= 1),
  constraint research_snapshots_idea_owner_fkey
    foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete cascade
);

alter table public.trade_idea_catalysts enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_snapshots enable row level security;

revoke all on public.trade_idea_catalysts, public.research_sources, public.research_snapshots
  from public, anon, authenticated;
grant select, insert, update, delete on public.trade_idea_catalysts, public.research_sources
  to authenticated;
grant select, insert on public.research_snapshots to authenticated;
grant select, insert, update, delete on public.trade_idea_catalysts, public.research_sources,
  public.research_snapshots to service_role;

create index catalysts_research_schedule_idx
  on public.catalysts(schedule_kind, scheduled_date, event_status)
  where deleted_at is null;
create index catalysts_date_certainty_idx on public.catalysts(date_certainty, scheduled_date)
  where deleted_at is null;
create index catalysts_tags_idx on public.catalysts using gin(tags);
create index trade_ideas_user_research_stage_idx
  on public.trade_ideas(user_id, research_stage, next_decision_at)
  where deleted_at is null;
create index trade_ideas_exposure_tags_idx on public.trade_ideas using gin(exposure_tags);
create index trade_idea_catalysts_user_idx on public.trade_idea_catalysts(user_id);
create index trade_idea_catalysts_idea_idx on public.trade_idea_catalysts(trade_idea_id);
create index trade_idea_catalysts_catalyst_idx on public.trade_idea_catalysts(catalyst_id);
create index research_sources_user_idx on public.research_sources(user_id);
create index research_sources_catalyst_idx on public.research_sources(catalyst_id)
  where catalyst_id is not null;
create index research_sources_idea_idx on public.research_sources(trade_idea_id)
  where trade_idea_id is not null;
create index research_snapshots_user_observed_idx
  on public.research_snapshots(user_id, observed_at desc);
create index research_snapshots_catalyst_idx
  on public.research_snapshots(catalyst_id, observed_at desc) where catalyst_id is not null;
create index research_snapshots_idea_idx
  on public.research_snapshots(trade_idea_id, observed_at desc) where trade_idea_id is not null;

create trigger research_sources_set_updated_at before update on public.research_sources
  for each row execute function private.set_updated_at();

create policy trade_idea_catalysts_owner_select on public.trade_idea_catalysts
  for select to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()));
create policy trade_idea_catalysts_owner_insert on public.trade_idea_catalysts
  for insert to authenticated
  with check (
    (select private.is_approved_user()) and user_id = (select auth.uid())
    and exists (
      select 1 from public.trade_ideas idea
      where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    )
    and exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id)
  );
create policy trade_idea_catalysts_owner_update on public.trade_idea_catalysts
  for update to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()))
  with check (
    (select private.is_approved_user()) and user_id = (select auth.uid())
    and exists (
      select 1 from public.trade_ideas idea
      where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    )
    and exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id)
  );
create policy trade_idea_catalysts_owner_delete on public.trade_idea_catalysts
  for delete to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()));

create policy research_sources_owner_select on public.research_sources
  for select to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()));
create policy research_sources_owner_insert on public.research_sources
  for insert to authenticated
  with check (
    (select private.is_approved_user()) and user_id = (select auth.uid())
    and (catalyst_id is null or exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id))
    and (trade_idea_id is null or exists (
      select 1 from public.trade_ideas idea where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    ))
  );
create policy research_sources_owner_update on public.research_sources
  for update to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()))
  with check (
    (select private.is_approved_user()) and user_id = (select auth.uid())
    and (catalyst_id is null or exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id))
    and (trade_idea_id is null or exists (
      select 1 from public.trade_ideas idea where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    ))
  );
create policy research_sources_owner_delete on public.research_sources
  for delete to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()));

create policy research_snapshots_owner_select on public.research_snapshots
  for select to authenticated
  using ((select private.is_approved_user()) and user_id = (select auth.uid()));
create policy research_snapshots_owner_insert on public.research_snapshots
  for insert to authenticated
  with check (
    (select private.is_approved_user()) and user_id = (select auth.uid())
    and (catalyst_id is null or exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id))
    and (trade_idea_id is null or exists (
      select 1 from public.trade_ideas idea where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    ))
    and (source_id is null or exists (
      select 1 from public.research_sources source where source.id = source_id and source.user_id = (select auth.uid())
    ))
  );

comment on column public.catalysts.schedule_kind is
  'Scheduled releases belong on the calendar; contextual risk is recorded without a false date.';
comment on column public.trade_ideas.research_stage is
  'Decision-research lifecycle. Trade entry remains separately user-confirmed.';
comment on table public.research_snapshots is
  'Append-only, timestamped inputs and methodology; event and expiration implied moves remain distinct.';
comment on column public.trade_ideas.risk_overshoot_acknowledged is
  'Explicit acknowledgement only. OJ never auto-sizes or executes a brokerage order.';

commit;
