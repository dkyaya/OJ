-- Phase 6: shared facts, responses, explicit thesis summaries, and private forks.

begin;

create table public.evidence_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  catalyst_id uuid not null references public.catalysts(id) on delete restrict,
  mission_id uuid,
  author_id uuid not null references public.profiles(id) on delete restrict,
  evidence_type text not null check (evidence_type in ('supports_bull','supports_bear','neutral','needs_verification')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 4000),
  source_label text,
  source_url text,
  observed_at timestamptz,
  confidence integer check (confidence between 0 and 100),
  affected_assumption text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','needs_review')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.evidence_responses (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_cards(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  response_type text not null check (response_type in ('comment','confirm','challenge','counter_source')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.shared_theses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  source_trade_idea_id uuid references public.trade_ideas(id) on delete set null,
  catalyst_id uuid references public.catalysts(id) on delete set null,
  ticker text not null check (ticker ~ '^[A-Z0-9._-]{1,20}$'),
  strategy text not null check (strategy in ('bull-call-spread','bear-put-spread')),
  bias text not null check (char_length(btrim(bias)) between 1 and 40),
  thesis_summary text not null check (char_length(btrim(thesis_summary)) between 1 and 3000),
  expected_move_summary text,
  confidence integer check (confidence between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.shared_thesis_responses (
  id uuid primary key default gen_random_uuid(),
  shared_thesis_id uuid not null references public.shared_theses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  response_type text not null default 'comment' check (response_type in ('comment','question','challenge')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.thesis_forks (
  id uuid primary key default gen_random_uuid(),
  shared_thesis_id uuid not null references public.shared_theses(id) on delete restrict,
  forked_by uuid not null references public.profiles(id) on delete cascade,
  trade_idea_id uuid not null references public.trade_ideas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shared_thesis_id, forked_by),
  unique (trade_idea_id)
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'member_joined','member_left','member_removed',
    'evidence_added','evidence_responded','thesis_shared','thesis_responded','thesis_forked',
    'mission_created','mission_updated','question_added','liquidity_added','forecast_shared','debrief_added'
  )),
  object_type text not null,
  object_id uuid,
  summary text not null check (char_length(summary) between 1 and 240),
  created_at timestamptz not null default now()
);

alter table public.evidence_cards enable row level security;
alter table public.evidence_responses enable row level security;
alter table public.shared_theses enable row level security;
alter table public.shared_thesis_responses enable row level security;
alter table public.thesis_forks enable row level security;
alter table public.activity_events enable row level security;

revoke all on public.evidence_cards, public.evidence_responses, public.shared_theses,
  public.shared_thesis_responses, public.thesis_forks, public.activity_events from public, anon, authenticated;
grant select, insert, update on public.evidence_cards, public.evidence_responses,
  public.shared_theses, public.shared_thesis_responses to authenticated;
grant select on public.thesis_forks, public.activity_events to authenticated;
grant select, insert, update, delete on public.evidence_cards, public.evidence_responses,
  public.shared_theses, public.shared_thesis_responses, public.thesis_forks, public.activity_events to service_role;

create index evidence_cards_workspace_catalyst_idx on public.evidence_cards(workspace_id, catalyst_id, created_at desc)
  where deleted_at is null;
create index evidence_cards_author_idx on public.evidence_cards(author_id);
create index evidence_cards_catalyst_idx on public.evidence_cards(catalyst_id);
create index evidence_cards_mission_idx on public.evidence_cards(mission_id) where mission_id is not null;
create index evidence_responses_evidence_idx on public.evidence_responses(evidence_id, created_at) where deleted_at is null;
create index evidence_responses_workspace_idx on public.evidence_responses(workspace_id);
create index evidence_responses_author_idx on public.evidence_responses(author_id);
create index shared_theses_workspace_catalyst_idx on public.shared_theses(workspace_id, catalyst_id, created_at desc)
  where archived_at is null;
create index shared_theses_author_idx on public.shared_theses(author_id);
create index shared_theses_catalyst_idx on public.shared_theses(catalyst_id) where catalyst_id is not null;
create index shared_theses_source_idea_idx on public.shared_theses(source_trade_idea_id) where source_trade_idea_id is not null;
create index shared_thesis_responses_thesis_idx on public.shared_thesis_responses(shared_thesis_id, created_at) where deleted_at is null;
create index shared_thesis_responses_workspace_idx on public.shared_thesis_responses(workspace_id);
create index shared_thesis_responses_author_idx on public.shared_thesis_responses(author_id);
create index thesis_forks_forked_by_idx on public.thesis_forks(forked_by);
create index activity_events_workspace_created_idx on public.activity_events(workspace_id, created_at desc);
create index activity_events_actor_idx on public.activity_events(actor_id);

create or replace function private.guard_shared_author_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if tg_op = 'INSERT' then
    if new.author_id <> (select auth.uid()) then raise exception 'author must match the current user'; end if;
    if not (select private.is_workspace_member(new.workspace_id)) then raise exception 'active workspace membership required'; end if;
  else
    if old.author_id <> (select auth.uid()) then raise exception 'only the author may edit this record'; end if;
    if new.author_id is distinct from old.author_id or new.workspace_id is distinct from old.workspace_id then
      raise exception 'shared record authorship and workspace are immutable';
    end if;
    if not (select private.is_workspace_member(new.workspace_id)) then raise exception 'active workspace membership required'; end if;
  end if;
  return new;
end
$$;
revoke all on function private.guard_shared_author_record() from public, anon, authenticated;

create trigger evidence_cards_author_guard before insert or update on public.evidence_cards
  for each row execute function private.guard_shared_author_record();
create trigger evidence_responses_author_guard before insert or update on public.evidence_responses
  for each row execute function private.guard_shared_author_record();
create trigger shared_theses_author_guard before insert or update on public.shared_theses
  for each row execute function private.guard_shared_author_record();
create trigger shared_thesis_responses_author_guard before insert or update on public.shared_thesis_responses
  for each row execute function private.guard_shared_author_record();

create trigger evidence_cards_set_updated_at before update on public.evidence_cards
  for each row execute function private.set_updated_at();
create trigger evidence_responses_set_updated_at before update on public.evidence_responses
  for each row execute function private.set_updated_at();
create trigger shared_theses_set_updated_at before update on public.shared_theses
  for each row execute function private.set_updated_at();
create trigger shared_thesis_responses_set_updated_at before update on public.shared_thesis_responses
  for each row execute function private.set_updated_at();

create policy evidence_cards_member_select on public.evidence_cards for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy evidence_cards_author_insert on public.evidence_cards for insert to authenticated
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id and catalyst.workspace_id = workspace_id and catalyst.visibility = 'workspace'));
create policy evidence_cards_author_update on public.evidence_cards for update to authenticated
  using ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy evidence_responses_member_select on public.evidence_responses for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy evidence_responses_author_insert on public.evidence_responses for insert to authenticated
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.evidence_cards evidence where evidence.id = evidence_id and evidence.workspace_id = workspace_id and evidence.deleted_at is null));
create policy evidence_responses_author_update on public.evidence_responses for update to authenticated
  using ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy shared_theses_member_select on public.shared_theses for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy shared_theses_author_insert on public.shared_theses for insert to authenticated
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.trade_ideas idea where idea.id = source_trade_idea_id and idea.user_id = (select auth.uid()))
    and (catalyst_id is null or exists (select 1 from public.catalysts catalyst where catalyst.id = catalyst_id and catalyst.workspace_id = workspace_id and catalyst.visibility = 'workspace')));
create policy shared_theses_author_update on public.shared_theses for update to authenticated
  using ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy shared_thesis_responses_member_select on public.shared_thesis_responses for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));
create policy shared_thesis_responses_author_insert on public.shared_thesis_responses for insert to authenticated
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and exists (select 1 from public.shared_theses thesis where thesis.id = shared_thesis_id and thesis.workspace_id = workspace_id and thesis.archived_at is null));
create policy shared_thesis_responses_author_update on public.shared_thesis_responses for update to authenticated
  using ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check ((select private.is_approved_user()) and author_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

create policy thesis_forks_owner_select on public.thesis_forks for select to authenticated
  using ((select private.is_approved_user()) and forked_by = (select auth.uid()));
create policy activity_events_member_select on public.activity_events for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));

create or replace function private.add_workspace_activity(
  p_workspace_id uuid, p_actor_id uuid, p_event_type text, p_object_type text, p_object_id uuid, p_summary text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or p_actor_id <> (select auth.uid()) or not (select private.is_workspace_member(p_workspace_id)) then
    raise exception 'valid workspace actor required';
  end if;
  if p_event_type not in ('member_joined','member_left','member_removed','evidence_added','evidence_responded','thesis_shared','thesis_responded','thesis_forked','mission_created','mission_updated','question_added','liquidity_added','forecast_shared','debrief_added') then
    raise exception 'private activity type denied';
  end if;
  insert into public.activity_events(workspace_id, actor_id, event_type, object_type, object_id, summary)
  values (p_workspace_id, p_actor_id, p_event_type, p_object_type, p_object_id, left(p_summary, 240));
end
$$;
revoke all on function private.add_workspace_activity(uuid, uuid, text, text, uuid, text) from public, anon, authenticated, service_role;

create or replace function private.log_workspace_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); event_name text; event_summary text;
begin
  if actor is null then return new; end if;
  if tg_op = 'INSERT' and new.membership_status = 'active' then
    event_name := 'member_joined'; event_summary := 'Joined the research workspace.';
  elsif tg_op = 'UPDATE' and new.membership_status is distinct from old.membership_status then
    if new.membership_status = 'active' then event_name := 'member_joined'; event_summary := 'Joined the research workspace.';
    elsif new.membership_status = 'left' then event_name := 'member_left'; event_summary := 'Left the research workspace.';
    elsif new.membership_status = 'removed' then event_name := 'member_removed'; event_summary := 'Removed a member from the research workspace.';
    else return new; end if;
  else return new; end if;
  perform private.add_workspace_activity(new.workspace_id, actor, event_name, 'workspace_member', new.user_id, event_summary);
  return new;
end
$$;
revoke all on function private.log_workspace_membership_activity() from public, anon, authenticated, service_role;
create trigger workspace_members_activity after insert or update on public.workspace_members
  for each row execute function private.log_workspace_membership_activity();

create or replace function private.log_shared_research_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_name text; object_name text; event_summary text;
begin
  if tg_op <> 'INSERT' then return new; end if;
  if tg_table_name = 'evidence_cards' then event_name := 'evidence_added'; object_name := 'evidence'; event_summary := 'Added shared evidence.';
  elsif tg_table_name = 'evidence_responses' then event_name := 'evidence_responded'; object_name := 'evidence_response'; event_summary := 'Responded to shared evidence.';
  elsif tg_table_name = 'shared_theses' then event_name := 'thesis_shared'; object_name := 'shared_thesis'; event_summary := 'Shared a thesis summary.';
  elsif tg_table_name = 'shared_thesis_responses' then event_name := 'thesis_responded'; object_name := 'shared_thesis_response'; event_summary := 'Responded to a shared thesis.';
  else return new;
  end if;
  perform private.add_workspace_activity(new.workspace_id, new.author_id, event_name, object_name, new.id, event_summary);
  return new;
end
$$;
revoke all on function private.log_shared_research_activity() from public, anon, authenticated;
create trigger evidence_cards_activity after insert on public.evidence_cards for each row execute function private.log_shared_research_activity();
create trigger evidence_responses_activity after insert on public.evidence_responses for each row execute function private.log_shared_research_activity();
create trigger shared_theses_activity after insert on public.shared_theses for each row execute function private.log_shared_research_activity();
create trigger shared_thesis_responses_activity after insert on public.shared_thesis_responses for each row execute function private.log_shared_research_activity();

create or replace function public.fork_shared_thesis(p_shared_thesis_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  thesis public.shared_theses%rowtype;
  forked_idea_id uuid := gen_random_uuid();
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  select * into thesis from public.shared_theses where id = p_shared_thesis_id and archived_at is null;
  if not found or not (select private.is_workspace_member(thesis.workspace_id)) then raise exception 'shared thesis not found'; end if;
  if exists (select 1 from public.thesis_forks where shared_thesis_id = thesis.id and forked_by = current_user_id) then
    raise exception 'this thesis is already forked';
  end if;

  insert into public.trade_ideas(
    id, user_id, ticker, strategy, bias, confidence, data, revision, sync_status,
    entry_status, user_confirmed_fill, source, mirror_status
  ) values (
    forked_idea_id, current_user_id, thesis.ticker, thesis.strategy, thesis.bias,
    case when thesis.confidence is null then null else thesis.confidence::text end,
    jsonb_build_object(
      'Status','draft',
      'Thesis',thesis.thesis_summary,
      'Expected move',coalesce(thesis.expected_move_summary,'TBD'),
      'forked_from_shared_thesis',true,
      'shared_thesis_id',thesis.id,
      'shared_catalyst_id',thesis.catalyst_id
    ),
    1, 'cloud_draft', 'not-entered', false, 'oj_app', 'not_requested'
  );
  insert into public.thesis_forks(shared_thesis_id, forked_by, trade_idea_id)
  values (thesis.id, current_user_id, forked_idea_id);
  perform private.add_workspace_activity(thesis.workspace_id, current_user_id, 'thesis_forked', 'shared_thesis', thesis.id, 'Forked a shared thesis into a private Idea.');
  return forked_idea_id;
end
$$;

revoke all on function public.fork_shared_thesis(uuid) from public, anon;
grant execute on function public.fork_shared_thesis(uuid) to authenticated;

comment on table public.evidence_cards is 'Workspace factual research. Evidence type is explicitly user-selected and is never inferred.';
comment on table public.shared_theses is 'Explicitly reviewed summaries only; private candidates, sizing, risk, and journal fields are never copied.';
comment on table public.activity_events is 'Allowlisted shared research activity only; no financial, trade, private forecast, or journal events.';

commit;
