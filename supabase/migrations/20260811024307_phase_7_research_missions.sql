-- Phase 7: professional, catalyst-linked research missions that remain complete when solo.

begin;

create table public.research_missions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  catalyst_id uuid not null references public.catalysts(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  completed_decision text check (completed_decision in ('trade','watch','no_trade')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  constraint research_missions_completion_consistent check (
    (status = 'completed' and completed_at is not null and completed_decision is not null)
    or (status <> 'completed' and completed_at is null and completed_decision is null)
  )
);

create unique index research_missions_one_primary_idx on public.research_missions(catalyst_id)
  where status in ('draft','active');

create table public.mission_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.research_missions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  role text check (role in ('macro_scout','market_mapper','options_mechanic','risk_officer','devils_advocate')),
  task text not null check (char_length(btrim(task)) between 1 and 240),
  status text not null default 'open' check (status in ('open','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint mission_assignments_completion_consistent check (
    (status = 'completed' and completed_at is not null) or (status = 'open' and completed_at is null)
  )
);

create table public.research_questions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.research_missions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  question text not null check (char_length(btrim(question)) between 1 and 1000),
  resolution text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint research_questions_resolution_consistent check (
    (status = 'resolved' and resolved_at is not null and resolution is not null)
    or (status = 'open' and resolved_at is null)
  )
);

create table public.options_liquidity_observations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.research_missions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ticker text not null check (ticker ~ '^[A-Z0-9._-]{1,20}$'),
  observation text not null check (char_length(btrim(observation)) between 1 and 2000),
  source_label text,
  observed_at timestamptz not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.mission_checkpoints (
  mission_id uuid not null references public.research_missions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checkpoint_type text not null check (checkpoint_type in (
    'event_verified','consensus_recorded','bull_case_built','bear_case_built',
    'securities_mapped','options_reviewed','trade_decision_recorded'
  )),
  status text not null default 'pending' check (status in ('pending','completed')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  note text,
  updated_at timestamptz not null default now(),
  primary key (mission_id, checkpoint_type),
  constraint mission_checkpoints_completion_consistent check (
    (status = 'completed' and completed_by is not null and completed_at is not null)
    or (status = 'pending' and completed_at is null)
  )
);

alter table public.evidence_cards
  add constraint evidence_cards_mission_fkey foreign key (mission_id) references public.research_missions(id) on delete set null;

alter table public.research_missions enable row level security;
alter table public.mission_assignments enable row level security;
alter table public.research_questions enable row level security;
alter table public.options_liquidity_observations enable row level security;
alter table public.mission_checkpoints enable row level security;

revoke all on public.research_missions, public.mission_assignments, public.research_questions,
  public.options_liquidity_observations, public.mission_checkpoints from public, anon, authenticated;
grant select, insert, update on public.research_missions, public.mission_assignments,
  public.research_questions, public.options_liquidity_observations to authenticated;
grant select on public.mission_checkpoints to authenticated;
grant select, insert, update, delete on public.research_missions, public.mission_assignments,
  public.research_questions, public.options_liquidity_observations, public.mission_checkpoints to service_role;

create index research_missions_workspace_status_idx on public.research_missions(workspace_id, status, updated_at desc);
create index research_missions_created_by_idx on public.research_missions(created_by);
create index mission_assignments_mission_idx on public.mission_assignments(mission_id, status);
create index mission_assignments_workspace_idx on public.mission_assignments(workspace_id);
create index mission_assignments_assignee_idx on public.mission_assignments(assignee_id) where assignee_id is not null;
create index mission_assignments_created_by_idx on public.mission_assignments(created_by);
create index research_questions_mission_idx on public.research_questions(mission_id, status);
create index research_questions_workspace_idx on public.research_questions(workspace_id);
create index research_questions_created_by_idx on public.research_questions(created_by);
create index research_questions_assigned_to_idx on public.research_questions(assigned_to) where assigned_to is not null;
create index liquidity_observations_mission_idx on public.options_liquidity_observations(mission_id, observed_at desc) where deleted_at is null;
create index liquidity_observations_workspace_idx on public.options_liquidity_observations(workspace_id);
create index liquidity_observations_created_by_idx on public.options_liquidity_observations(created_by);
create index mission_checkpoints_workspace_idx on public.mission_checkpoints(workspace_id);
create index mission_checkpoints_completed_by_idx on public.mission_checkpoints(completed_by) where completed_by is not null;

create or replace function private.guard_mission_created_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if tg_op = 'INSERT' then
    if new.created_by <> (select auth.uid()) or not (select private.is_workspace_member(new.workspace_id)) then
      raise exception 'valid workspace creator required';
    end if;
  else
    if new.created_by is distinct from old.created_by or new.workspace_id is distinct from old.workspace_id then
      raise exception 'workspace scope and creator are immutable';
    end if;
    if not (select private.is_workspace_member(new.workspace_id)) then raise exception 'active workspace membership required'; end if;
  end if;
  return new;
end
$$;
revoke all on function private.guard_mission_created_record() from public, anon, authenticated;

create or replace function private.guard_mission_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
    and coalesce(current_setting('oj.mission_completion_context', true), '') <> 'complete_research_mission'
  then raise exception 'mission completion is server-managed'; end if;
  return new;
end
$$;
revoke all on function private.guard_mission_status() from public, anon, authenticated;

create trigger research_missions_creator_guard before insert or update on public.research_missions
  for each row execute function private.guard_mission_created_record();
create trigger research_missions_status_guard before update on public.research_missions
  for each row execute function private.guard_mission_status();
create trigger mission_assignments_creator_guard before insert or update on public.mission_assignments
  for each row execute function private.guard_mission_created_record();
create trigger research_questions_creator_guard before insert or update on public.research_questions
  for each row execute function private.guard_mission_created_record();
create trigger liquidity_observations_creator_guard before insert or update on public.options_liquidity_observations
  for each row execute function private.guard_mission_created_record();

create trigger research_missions_set_updated_at before update on public.research_missions for each row execute function private.set_updated_at();
create trigger mission_assignments_set_updated_at before update on public.mission_assignments for each row execute function private.set_updated_at();
create trigger research_questions_set_updated_at before update on public.research_questions for each row execute function private.set_updated_at();
create trigger liquidity_observations_set_updated_at before update on public.options_liquidity_observations for each row execute function private.set_updated_at();

create policy research_missions_member_select on public.research_missions for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy research_missions_member_insert on public.research_missions for insert to authenticated
  with check ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id and catalyst.workspace_id = workspace_id and catalyst.visibility = 'workspace'));
create policy research_missions_member_update on public.research_missions for update to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));

create policy mission_assignments_member_select on public.mission_assignments for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy mission_assignments_member_insert on public.mission_assignments for insert to authenticated
  with check ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.research_missions mission where mission.id = mission_id and mission.workspace_id = workspace_id)
    and (assignee_id is null or exists (select 1 from public.workspace_members member where member.workspace_id = workspace_id and member.user_id = assignee_id and member.membership_status = 'active')));
create policy mission_assignments_participant_update on public.mission_assignments for update to authenticated
  using ((select private.is_approved_user()) and (created_by = (select auth.uid()) or assignee_id = (select auth.uid())) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and (created_by = (select auth.uid()) or assignee_id = (select auth.uid())) and (select private.is_workspace_member(workspace_id)));

create policy research_questions_member_select on public.research_questions for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy research_questions_member_insert on public.research_questions for insert to authenticated
  with check ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.research_missions mission where mission.id = mission_id and mission.workspace_id = workspace_id));
create policy research_questions_participant_update on public.research_questions for update to authenticated
  using ((select private.is_approved_user()) and (created_by = (select auth.uid()) or assigned_to = (select auth.uid())) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and (created_by = (select auth.uid()) or assigned_to = (select auth.uid())) and (select private.is_workspace_member(workspace_id)));

create policy liquidity_observations_member_select on public.options_liquidity_observations for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy liquidity_observations_author_insert on public.options_liquidity_observations for insert to authenticated
  with check ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.research_missions mission where mission.id = mission_id and mission.workspace_id = workspace_id));
create policy liquidity_observations_author_update on public.options_liquidity_observations for update to authenticated
  using ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and created_by = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy mission_checkpoints_member_select on public.mission_checkpoints for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));

create or replace function public.set_mission_checkpoint(
  p_mission_id uuid, p_checkpoint_type text, p_completed boolean, p_note text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid()); mission public.research_missions%rowtype;
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if p_checkpoint_type not in ('event_verified','consensus_recorded','bull_case_built','bear_case_built','securities_mapped','options_reviewed','trade_decision_recorded') then raise exception 'valid checkpoint required'; end if;
  select * into mission from public.research_missions where id = p_mission_id and archived_at is null;
  if not found or not (select private.is_workspace_member(mission.workspace_id)) then raise exception 'research mission not found'; end if;
  insert into public.mission_checkpoints(mission_id, workspace_id, checkpoint_type, status, completed_by, completed_at, note)
  values (mission.id, mission.workspace_id, p_checkpoint_type, case when p_completed then 'completed' else 'pending' end,
          case when p_completed then current_user_id else null end, case when p_completed then now() else null end, nullif(btrim(p_note), ''))
  on conflict (mission_id, checkpoint_type) do update
    set status = excluded.status, completed_by = excluded.completed_by,
        completed_at = excluded.completed_at, note = excluded.note, updated_at = now();
end
$$;

create or replace function public.complete_research_mission(p_mission_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare mission public.research_missions%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if p_decision not in ('trade','watch','no_trade') then raise exception 'record a Trade, Watch, or No Trade decision'; end if;
  select * into mission from public.research_missions where id = p_mission_id for update;
  if not found or not (select private.is_workspace_member(mission.workspace_id)) then raise exception 'research mission not found'; end if;
  if mission.status not in ('draft','active') then raise exception 'research mission cannot be completed'; end if;
  if not exists (select 1 from public.evidence_cards evidence where evidence.mission_id = mission.id and evidence.deleted_at is null) then
    raise exception 'add evidence before completing the mission';
  end if;
  if not exists (select 1 from public.mission_checkpoints checkpoint where checkpoint.mission_id = mission.id and checkpoint.checkpoint_type = 'event_verified' and checkpoint.status = 'completed') then
    raise exception 'verify the event before completing the mission';
  end if;
  perform set_config('oj.mission_completion_context', 'complete_research_mission', true);
  update public.research_missions
  set status = 'completed', completed_decision = p_decision, completed_at = now(), updated_at = now()
  where id = mission.id;
  insert into public.mission_checkpoints(mission_id, workspace_id, checkpoint_type, status, completed_by, completed_at)
  values (mission.id, mission.workspace_id, 'trade_decision_recorded', 'completed', (select auth.uid()), now())
  on conflict (mission_id, checkpoint_type) do update
    set status = 'completed', completed_by = excluded.completed_by, completed_at = excluded.completed_at, updated_at = now();
end
$$;

revoke all on function public.set_mission_checkpoint(uuid, text, boolean, text), public.complete_research_mission(uuid, text) from public, anon;
grant execute on function public.set_mission_checkpoint(uuid, text, boolean, text), public.complete_research_mission(uuid, text) to authenticated;

create or replace function private.log_mission_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_name text; event_summary text; actor uuid;
begin
  if tg_table_name = 'research_missions' then
    actor := coalesce((select auth.uid()), new.created_by);
    if tg_op = 'INSERT' then event_name := 'mission_created'; event_summary := 'Created a Research Mission.';
    elsif new.status is distinct from old.status then event_name := 'mission_updated'; event_summary := 'Updated a Research Mission.';
    else return new; end if;
  elsif tg_table_name = 'research_questions' then actor := new.created_by; event_name := 'question_added'; event_summary := 'Added an open research question.';
  elsif tg_table_name = 'options_liquidity_observations' then actor := new.created_by; event_name := 'liquidity_added'; event_summary := 'Added an options-liquidity observation.';
  else return new; end if;
  perform private.add_workspace_activity(new.workspace_id, actor, event_name, tg_table_name, new.id, event_summary);
  return new;
end
$$;
revoke all on function private.log_mission_activity() from public, anon, authenticated;
create trigger research_missions_activity after insert or update on public.research_missions for each row execute function private.log_mission_activity();
create trigger research_questions_activity after insert on public.research_questions for each row execute function private.log_mission_activity();
create trigger liquidity_observations_activity after insert on public.options_liquidity_observations for each row execute function private.log_mission_activity();

comment on table public.research_missions is 'Catalyst research structure; roles organize work but never grant permissions, and No Trade is a valid completion.';
comment on table public.mission_assignments is 'Optional organizational roles and tasks; unassigned roles never block contribution.';

commit;
