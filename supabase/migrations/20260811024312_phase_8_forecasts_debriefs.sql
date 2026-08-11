-- Phase 8: private-by-default forecasts, immutable revisions, factual debriefs, and calibration inputs.

begin;

create table public.personal_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  catalyst_id uuid not null references public.catalysts(id) on delete restrict,
  mission_id uuid references public.research_missions(id) on delete set null,
  expected_result text not null check (char_length(btrim(expected_result)) between 1 and 3000),
  expected_result_data jsonb not null default '{}'::jsonb check (jsonb_typeof(expected_result_data) = 'object'),
  market_direction text not null check (market_direction in ('bullish','bearish','neutral','mixed')),
  expected_magnitude numeric,
  magnitude_unit text not null default 'percent' check (magnitude_unit in ('percent','points','qualitative')),
  confidence integer not null check (confidence between 0 and 100),
  preferred_ticker text check (preferred_ticker is null or preferred_ticker ~ '^[A-Z0-9._-]{1,20}$'),
  intended_strategy text,
  trade_decision text not null default 'undecided' check (trade_decision in ('trade','watch','no_trade','undecided')),
  visibility text not null default 'private' check (visibility in ('private','workspace')),
  revision integer not null default 1 check (revision > 0),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, catalyst_id)
);

create table public.forecast_revisions (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null references public.personal_forecasts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  revision integer not null check (revision > 0),
  snapshot_type text not null check (snapshot_type in ('draft','locked')),
  visibility_at_revision text not null check (visibility_at_revision in ('private','workspace')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  revision_reason text,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (forecast_id, revision, snapshot_type),
  constraint forecast_revisions_locked_consistent check (
    (snapshot_type = 'locked' and locked_at is not null)
    or (snapshot_type = 'draft' and locked_at is null)
  )
);

create table public.mission_debriefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_id uuid not null references public.research_missions(id) on delete cascade,
  catalyst_id uuid not null references public.catalysts(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  actual_result text not null check (char_length(btrim(actual_result)) between 1 and 3000),
  actual_direction text check (actual_direction in ('bullish','bearish','neutral','mixed')),
  actual_magnitude numeric,
  market_reaction text not null check (char_length(btrim(market_reaction)) between 1 and 3000),
  key_driver text,
  what_worked text,
  what_missed text,
  unexpected_factor text,
  shared_summary text,
  visibility text not null default 'workspace' check (visibility in ('private','workspace')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, author_id)
);

alter table public.personal_forecasts enable row level security;
alter table public.forecast_revisions enable row level security;
alter table public.mission_debriefs enable row level security;

revoke all on public.personal_forecasts, public.forecast_revisions, public.mission_debriefs from public, anon, authenticated;
grant select on public.personal_forecasts, public.forecast_revisions to authenticated;
grant select, insert, update on public.mission_debriefs to authenticated;
grant select, insert, update, delete on public.personal_forecasts, public.forecast_revisions, public.mission_debriefs to service_role;

create index personal_forecasts_workspace_catalyst_idx on public.personal_forecasts(workspace_id, catalyst_id, updated_at desc);
create index personal_forecasts_user_idx on public.personal_forecasts(user_id, updated_at desc);
create index personal_forecasts_catalyst_idx on public.personal_forecasts(catalyst_id);
create index personal_forecasts_mission_idx on public.personal_forecasts(mission_id) where mission_id is not null;
create index forecast_revisions_forecast_idx on public.forecast_revisions(forecast_id, revision desc, created_at desc);
create index forecast_revisions_user_idx on public.forecast_revisions(user_id);
create index forecast_revisions_workspace_idx on public.forecast_revisions(workspace_id) where visibility_at_revision = 'workspace';
create index mission_debriefs_workspace_catalyst_idx on public.mission_debriefs(workspace_id, catalyst_id, created_at desc);
create index mission_debriefs_author_idx on public.mission_debriefs(author_id);
create index mission_debriefs_catalyst_idx on public.mission_debriefs(catalyst_id);

create policy personal_forecasts_visibility_select on public.personal_forecasts for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      user_id = (select auth.uid())
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  );
create policy forecast_revisions_visibility_select on public.forecast_revisions for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      user_id = (select auth.uid())
      or (visibility_at_revision = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  );

create policy mission_debriefs_visibility_select on public.mission_debriefs for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      author_id = (select auth.uid())
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  );
create policy mission_debriefs_author_insert on public.mission_debriefs for insert to authenticated
  with check (
    (select private.is_approved_user()) and author_id = (select auth.uid())
    and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.research_missions mission where mission.id = mission_id and mission.workspace_id = workspace_id and mission.catalyst_id = catalyst_id)
  );
create policy mission_debriefs_author_update on public.mission_debriefs for update to authenticated
  using ((select private.is_approved_user()) and author_id = (select auth.uid()))
  with check ((select private.is_approved_user()) and author_id = (select auth.uid())
    and (visibility = 'private' or (select private.is_workspace_member(workspace_id))));

create or replace function private.forecast_snapshot(p_forecast public.personal_forecasts)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'expected_result', p_forecast.expected_result,
    'expected_result_data', p_forecast.expected_result_data,
    'market_direction', p_forecast.market_direction,
    'expected_magnitude', p_forecast.expected_magnitude,
    'magnitude_unit', p_forecast.magnitude_unit,
    'confidence', p_forecast.confidence,
    'preferred_ticker', p_forecast.preferred_ticker,
    'intended_strategy', p_forecast.intended_strategy,
    'trade_decision', p_forecast.trade_decision,
    'visibility', p_forecast.visibility,
    'revision', p_forecast.revision
  )
$$;
revoke all on function private.forecast_snapshot(public.personal_forecasts) from public, anon, authenticated;

create or replace function private.guard_forecast_core()
returns trigger
language plpgsql
set search_path = ''
as $$
declare event_time timestamptz;
begin
  if new.user_id is distinct from old.user_id
    or new.workspace_id is distinct from old.workspace_id
    or new.catalyst_id is distinct from old.catalyst_id
  then raise exception 'forecast ownership and event are immutable'; end if;

  if new.expected_result is distinct from old.expected_result
    or new.expected_result_data is distinct from old.expected_result_data
    or new.market_direction is distinct from old.market_direction
    or new.expected_magnitude is distinct from old.expected_magnitude
    or new.magnitude_unit is distinct from old.magnitude_unit
    or new.confidence is distinct from old.confidence
    or new.preferred_ticker is distinct from old.preferred_ticker
    or new.intended_strategy is distinct from old.intended_strategy
    or new.trade_decision is distinct from old.trade_decision
  then
    select event_at into event_time from public.catalysts where id = old.catalyst_id;
    if event_time is null or now() >= event_time then raise exception 'pre-event forecast is immutable after the event cutoff'; end if;
    if coalesce(current_setting('oj.forecast_write_context', true), '') <> 'forecast_rpc' then
      raise exception 'forecast revisions are server-managed';
    end if;
  end if;
  return new;
end
$$;
revoke all on function private.guard_forecast_core() from public, anon, authenticated;
create trigger personal_forecasts_core_guard before update on public.personal_forecasts
  for each row execute function private.guard_forecast_core();
create trigger personal_forecasts_set_updated_at before update on public.personal_forecasts
  for each row execute function private.set_updated_at();

create or replace function public.save_personal_forecast(
  p_forecast_id uuid,
  p_workspace_id uuid,
  p_catalyst_id uuid,
  p_mission_id uuid,
  p_expected_result text,
  p_expected_result_data jsonb,
  p_market_direction text,
  p_expected_magnitude numeric,
  p_magnitude_unit text,
  p_confidence integer,
  p_preferred_ticker text,
  p_intended_strategy text,
  p_trade_decision text,
  p_visibility text,
  p_expected_revision integer,
  p_revision_reason text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  catalyst public.catalysts%rowtype;
  current_forecast public.personal_forecasts%rowtype;
  next_forecast public.personal_forecasts%rowtype;
  resolved_id uuid := coalesce(p_forecast_id, gen_random_uuid());
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if not (select private.is_workspace_member(p_workspace_id)) then raise exception 'active workspace membership required'; end if;
  select * into catalyst from public.catalysts where id = p_catalyst_id and workspace_id = p_workspace_id and visibility = 'workspace' and deleted_at is null;
  if not found then raise exception 'workspace catalyst not found'; end if;
  if catalyst.event_at is null or now() >= catalyst.event_at then raise exception 'the pre-event forecast cutoff has passed'; end if;
  if p_market_direction not in ('bullish','bearish','neutral','mixed') then raise exception 'valid market direction required'; end if;
  if p_trade_decision not in ('trade','watch','no_trade','undecided') then raise exception 'valid trade decision required'; end if;
  if p_visibility not in ('private','workspace') then raise exception 'valid forecast visibility required'; end if;
  if p_magnitude_unit not in ('percent','points','qualitative') then raise exception 'valid magnitude unit required'; end if;
  if p_confidence is null or p_confidence not between 0 and 100 then raise exception 'confidence must be between 0 and 100'; end if;
  if p_expected_result is null or char_length(btrim(p_expected_result)) not between 1 and 3000 then raise exception 'expected result required'; end if;
  if p_expected_result_data is null or jsonb_typeof(p_expected_result_data) <> 'object' then raise exception 'expected result data must be an object'; end if;
  if p_preferred_ticker is not null and upper(btrim(p_preferred_ticker)) !~ '^[A-Z0-9._-]{1,20}$' then raise exception 'valid preferred ticker required'; end if;
  if p_mission_id is not null and not exists (
    select 1 from public.research_missions mission where mission.id = p_mission_id and mission.workspace_id = p_workspace_id and mission.catalyst_id = p_catalyst_id
  ) then raise exception 'research mission does not match the catalyst'; end if;

  if p_forecast_id is null then
    insert into public.personal_forecasts(
      id,user_id,workspace_id,catalyst_id,mission_id,expected_result,expected_result_data,
      market_direction,expected_magnitude,magnitude_unit,confidence,preferred_ticker,
      intended_strategy,trade_decision,visibility,revision
    ) values (
      resolved_id,current_user_id,p_workspace_id,p_catalyst_id,p_mission_id,btrim(p_expected_result),p_expected_result_data,
      p_market_direction,p_expected_magnitude,p_magnitude_unit,p_confidence,nullif(upper(btrim(p_preferred_ticker)),''),
      nullif(btrim(p_intended_strategy),''),p_trade_decision,p_visibility,1
    ) returning * into next_forecast;
  else
    select * into current_forecast from public.personal_forecasts where id = p_forecast_id and user_id = current_user_id for update;
    if not found then raise exception 'forecast not found'; end if;
    if current_forecast.workspace_id <> p_workspace_id or current_forecast.catalyst_id <> p_catalyst_id then raise exception 'forecast event cannot change'; end if;
    if p_expected_revision is null or current_forecast.revision <> p_expected_revision then raise exception 'forecast changed on another device'; end if;
    if p_revision_reason is null or char_length(btrim(p_revision_reason)) not between 1 and 1000 then raise exception 'revision reason required'; end if;
    perform set_config('oj.forecast_write_context', 'forecast_rpc', true);
    update public.personal_forecasts set
      mission_id=p_mission_id, expected_result=btrim(p_expected_result), expected_result_data=p_expected_result_data,
      market_direction=p_market_direction, expected_magnitude=p_expected_magnitude, magnitude_unit=p_magnitude_unit,
      confidence=p_confidence, preferred_ticker=nullif(upper(btrim(p_preferred_ticker)),''),
      intended_strategy=nullif(btrim(p_intended_strategy),''), trade_decision=p_trade_decision,
      visibility=p_visibility, revision=revision+1, locked_at=null, updated_at=now()
    where id=current_forecast.id returning * into next_forecast;
  end if;

  insert into public.forecast_revisions(
    forecast_id,user_id,workspace_id,revision,snapshot_type,visibility_at_revision,snapshot,revision_reason
  ) values (
    next_forecast.id,current_user_id,next_forecast.workspace_id,next_forecast.revision,'draft',next_forecast.visibility,
    private.forecast_snapshot(next_forecast),case when p_forecast_id is null then null else btrim(p_revision_reason) end
  );
  return next_forecast.id;
end
$$;

create or replace function public.lock_personal_forecast(p_forecast_id uuid, p_expected_revision integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid()); forecast public.personal_forecasts%rowtype; event_time timestamptz; locked_time timestamptz := now();
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  select * into forecast from public.personal_forecasts where id = p_forecast_id and user_id = current_user_id for update;
  if not found then raise exception 'forecast not found'; end if;
  if forecast.revision <> p_expected_revision then raise exception 'forecast changed on another device'; end if;
  if forecast.locked_at is not null then raise exception 'forecast revision is already locked'; end if;
  select event_at into event_time from public.catalysts where id = forecast.catalyst_id;
  if event_time is null or locked_time >= event_time then raise exception 'the pre-event forecast cutoff has passed'; end if;
  perform set_config('oj.forecast_write_context', 'forecast_rpc', true);
  update public.personal_forecasts set locked_at = locked_time, updated_at = locked_time where id = forecast.id returning * into forecast;
  insert into public.forecast_revisions(
    forecast_id,user_id,workspace_id,revision,snapshot_type,visibility_at_revision,snapshot,revision_reason,locked_at
  ) values (forecast.id,forecast.user_id,forecast.workspace_id,forecast.revision,'locked',forecast.visibility,
            private.forecast_snapshot(forecast),null,locked_time);
  if forecast.visibility = 'workspace' then
    perform private.add_workspace_activity(forecast.workspace_id,current_user_id,'forecast_shared','personal_forecast',forecast.id,'Locked and shared a forecast viewpoint.');
  end if;
  return locked_time;
end
$$;

create or replace function public.set_forecast_visibility(p_forecast_id uuid, p_visibility text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid()); forecast public.personal_forecasts%rowtype;
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if p_visibility not in ('private','workspace') then raise exception 'valid forecast visibility required'; end if;
  select * into forecast from public.personal_forecasts where id = p_forecast_id and user_id = current_user_id for update;
  if not found then raise exception 'forecast not found'; end if;
  if p_visibility = 'workspace' and not (select private.is_workspace_member(forecast.workspace_id)) then raise exception 'active workspace membership required'; end if;
  perform set_config('oj.forecast_write_context', 'forecast_rpc', true);
  update public.personal_forecasts set visibility = p_visibility, updated_at = now() where id = forecast.id;
  if forecast.visibility = 'private' and p_visibility = 'workspace' then
    perform private.add_workspace_activity(forecast.workspace_id,current_user_id,'forecast_shared','personal_forecast',forecast.id,'Shared a forecast viewpoint.');
  end if;
end
$$;

revoke all on function public.save_personal_forecast(uuid,uuid,uuid,uuid,text,jsonb,text,numeric,text,integer,text,text,text,text,integer,text),
  public.lock_personal_forecast(uuid,integer), public.set_forecast_visibility(uuid,text) from public, anon;
grant execute on function public.save_personal_forecast(uuid,uuid,uuid,uuid,text,jsonb,text,numeric,text,integer,text,text,text,text,integer,text),
  public.lock_personal_forecast(uuid,integer), public.set_forecast_visibility(uuid,text) to authenticated;

create or replace function private.guard_debrief_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if tg_op = 'INSERT' then
    if new.author_id <> (select auth.uid()) or not (select private.is_workspace_member(new.workspace_id)) then raise exception 'valid debrief author required'; end if;
  else
    if old.author_id <> (select auth.uid()) or new.author_id is distinct from old.author_id
      or new.workspace_id is distinct from old.workspace_id or new.mission_id is distinct from old.mission_id
      or new.catalyst_id is distinct from old.catalyst_id
    then raise exception 'debrief ownership and event are immutable'; end if;
    if new.visibility = 'workspace' and not (select private.is_workspace_member(new.workspace_id)) then raise exception 'active workspace membership required to share'; end if;
  end if;
  return new;
end
$$;
revoke all on function private.guard_debrief_author() from public, anon, authenticated;
create trigger mission_debriefs_author_guard before insert or update on public.mission_debriefs for each row execute function private.guard_debrief_author();
create trigger mission_debriefs_set_updated_at before update on public.mission_debriefs for each row execute function private.set_updated_at();

create or replace function private.log_debrief_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'workspace' then
    perform private.add_workspace_activity(new.workspace_id,new.author_id,'debrief_added','mission_debrief',new.id,'Added a shared factual debrief.');
  end if;
  return new;
end
$$;
revoke all on function private.log_debrief_activity() from public, anon, authenticated;
create trigger mission_debriefs_activity after insert on public.mission_debriefs for each row execute function private.log_debrief_activity();

comment on table public.personal_forecasts is 'User-owned pre-event forecast. Private by default; workspace visibility shares only forecast fields.';
comment on table public.forecast_revisions is 'Append-only forecast snapshots. Draft and locked rows are never browser-updatable.';
comment on table public.mission_debriefs is 'Factual event debriefs; personal lessons remain in the private Journal.';

commit;
