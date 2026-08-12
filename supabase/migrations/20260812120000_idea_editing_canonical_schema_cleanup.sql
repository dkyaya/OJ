-- Canonical Idea editing and vocabulary cleanup.
-- Preserves legacy labels and event types while giving new writes stable fields.

begin;

alter table public.trade_ideas
  add column idea_status text not null default 'draft'
    check (idea_status in ('watchlist','ready','deferred','draft','rejected','invalidated'));

update public.trade_ideas
set idea_status = case lower(coalesce(nullif(btrim(data->>'Status'), ''), nullif(btrim(data->>'status'), '')))
  when 'watchlist' then 'watchlist'
  when 'ready' then 'ready'
  when 'deferred' then 'deferred'
  when 'draft' then 'draft'
  when 'rejected' then 'rejected'
  when 'invalidated' then 'invalidated'
  else 'draft'
end,
data = case
  when lower(coalesce(nullif(btrim(data->>'Status'), ''), nullif(btrim(data->>'status'), ''))) in
       ('watchlist','ready','deferred','draft','rejected','invalidated') then data
  when coalesce(nullif(btrim(data->>'Status'), ''), nullif(btrim(data->>'status'), '')) is null then data
  else jsonb_set(data, '{Legacy Status}', to_jsonb(coalesce(data->>'Status', data->>'status')), true)
end;

alter table public.catalysts
  add column catalyst_category text
    check (catalyst_category is null or catalyst_category in (
      'Employment','Inflation','Growth / Activity','Central Bank','Earnings',
      'Company / Corporate','Rates / Treasury','Fiscal Policy','Trade / Tariffs',
      'Regulation / Legal','Geopolitical','Commodity / Energy',
      'Technical / Market Structure','Other'
    ));

-- Only deterministic legacy values are promoted. In particular, "Policy" is
-- intentionally left null because it could mean fiscal, monetary, trade,
-- regulation, or another policy domain. event_type remains as provenance.
update public.catalysts
set catalyst_category = case lower(btrim(event_type))
  when 'employment' then 'Employment'
  when 'jobs' then 'Employment'
  when 'labor' then 'Employment'
  when 'inflation' then 'Inflation'
  when 'growth' then 'Growth / Activity'
  when 'activity' then 'Growth / Activity'
  when 'growth / activity' then 'Growth / Activity'
  when 'central bank' then 'Central Bank'
  when 'central bank policy' then 'Central Bank'
  when 'fed' then 'Central Bank'
  when 'earnings' then 'Earnings'
  when 'company' then 'Company / Corporate'
  when 'corporate' then 'Company / Corporate'
  when 'company / corporate' then 'Company / Corporate'
  when 'rates' then 'Rates / Treasury'
  when 'treasury' then 'Rates / Treasury'
  when 'rates / treasury' then 'Rates / Treasury'
  when 'fiscal policy' then 'Fiscal Policy'
  when 'trade' then 'Trade / Tariffs'
  when 'tariffs' then 'Trade / Tariffs'
  when 'trade / tariffs' then 'Trade / Tariffs'
  when 'regulation' then 'Regulation / Legal'
  when 'legal' then 'Regulation / Legal'
  when 'regulation / legal' then 'Regulation / Legal'
  when 'geopolitical' then 'Geopolitical'
  when 'commodity' then 'Commodity / Energy'
  when 'energy' then 'Commodity / Energy'
  when 'commodity / energy' then 'Commodity / Energy'
  when 'technical' then 'Technical / Market Structure'
  when 'market structure' then 'Technical / Market Structure'
  when 'technical / market structure' then 'Technical / Market Structure'
  when 'other' then 'Other'
  else null
end
where catalyst_category is null;

alter table public.trade_candidates
  drop constraint if exists trade_candidates_name_check;
alter table public.trade_candidates
  add constraint trade_candidates_name_check
    check (name in ('Candidate','Balanced','Aggressive'));

create or replace function private.reject_revision_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'trade_ideas'
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
     and old.deleted_at is not null then
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

drop trigger if exists reject_revision_only_update on public.trade_ideas;
create trigger reject_revision_only_update
  before update on public.trade_ideas
  for each row execute function private.reject_revision_only_update();

drop trigger if exists reject_revision_only_update on public.trade_candidates;
create trigger reject_revision_only_update
  before update on public.trade_candidates
  for each row execute function private.reject_revision_only_update();

create or replace function public.save_trade_idea_edit(
  p_trade_idea_id uuid,
  p_expected_revision integer,
  p_record jsonb,
  p_candidate_id uuid,
  p_candidate jsonb
)
returns public.trade_ideas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  idea public.trade_ideas;
  saved_idea public.trade_ideas;
  candidate public.trade_candidates;
  candidate_data jsonb;
  candidate_changed boolean := false;
begin
  if owner_id is null or not (select private.is_approved_user()) then
    raise exception 'approved account required';
  end if;
  if p_trade_idea_id is null or p_expected_revision is null or p_expected_revision < 1
     or p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'invalid Idea edit request';
  end if;

  select * into idea from public.trade_ideas
  where id=p_trade_idea_id and user_id=owner_id
  for update;
  if not found then raise exception 'trade idea not found'; end if;
  if idea.deleted_at is not null then raise exception 'restore the archived idea before editing it'; end if;
  if idea.revision <> p_expected_revision then raise exception 'trade idea changed on another device'; end if;
  if lower(coalesce(p_record->>'idea_status','')) not in ('watchlist','ready','deferred','draft','rejected','invalidated') then raise exception 'invalid Idea status'; end if;
  if lower(coalesce(p_record->>'strategy','')) not in ('bull-call-spread','bear-put-spread') then raise exception 'invalid Idea strategy'; end if;
  if char_length(btrim(coalesce(p_record->>'ticker',''))) not between 1 and 20 then raise exception 'invalid Idea ticker'; end if;

  update public.trade_ideas set
    ticker=upper(btrim(p_record->>'ticker')),
    underlying_type=nullif(btrim(p_record->>'underlying_type'),''),
    strategy=lower(p_record->>'strategy'),
    bias=btrim(p_record->>'bias'),
    idea_status=lower(p_record->>'idea_status'),
    confidence=nullif(btrim(p_record->>'confidence'),''),
    originating_catalyst_id=nullif(p_record->>'originating_catalyst_id','')::uuid,
    planned_hold_through_events=coalesce(p_record->'planned_hold_through_events','[]'::jsonb),
    planned_avoid_events=coalesce(p_record->'planned_avoid_events','[]'::jsonb),
    contracts=nullif(p_record->>'contracts','')::integer,
    data=coalesce(p_record->'data','{}'::jsonb),
    revision=idea.revision+1,
    sync_status='cloud_draft',
    source='oj_app',
    updated_at=now()
  where id=idea.id and user_id=owner_id and revision=idea.revision
  returning * into saved_idea;

  if p_candidate is not null and coalesce((p_candidate->>'enabled')::boolean,false) then
    candidate_data := jsonb_build_object(
      'label','Candidate',
      'long_strike',p_candidate->'long_strike',
      'short_strike',p_candidate->'short_strike',
      'debit',p_candidate->'debit',
      'contracts',p_candidate->'contracts',
      'max_loss',p_candidate->'max_loss',
      'max_profit',p_candidate->'max_profit',
      'break_even',p_candidate->'break_even'
    );
    select * into candidate from public.trade_candidates
    where id=p_candidate_id and user_id=owner_id
    for update;
    if found then
      if candidate.trade_idea_id <> idea.id then raise exception 'candidate does not belong to this Idea'; end if;
      candidate_changed := (candidate.data->'long_strike') is distinct from (candidate_data->'long_strike')
        or (candidate.data->'short_strike') is distinct from (candidate_data->'short_strike')
        or (candidate.data->'debit') is distinct from (candidate_data->'debit')
        or (candidate.data->'contracts') is distinct from (candidate_data->'contracts')
        or (candidate.data->'max_loss') is distinct from (candidate_data->'max_loss')
        or (candidate.data->'max_profit') is distinct from (candidate_data->'max_profit')
        or (candidate.data->'break_even') is distinct from (candidate_data->'break_even');
      if candidate_changed then
        update public.trade_candidates set name='Candidate', data=candidate_data,
          revision=candidate.revision+1, source='oj_app', updated_at=now()
        where id=candidate.id and user_id=owner_id and revision=candidate.revision;
      end if;
    else
      insert into public.trade_candidates(id,trade_idea_id,user_id,name,data,revision,source)
      values (p_candidate_id,idea.id,owner_id,'Candidate',candidate_data,1,'oj_app');
    end if;
  end if;

  return saved_idea;
end
$$;

revoke all on function public.save_trade_idea_edit(uuid,integer,jsonb,uuid,jsonb) from public, anon;
grant execute on function public.save_trade_idea_edit(uuid,integer,jsonb,uuid,jsonb) to authenticated;

create index trade_ideas_owner_status_updated_idx
  on public.trade_ideas(user_id, idea_status, updated_at desc)
  where deleted_at is null;
create index catalysts_category_schedule_idx
  on public.catalysts(catalyst_category, scheduled_date)
  where deleted_at is null and catalyst_category is not null;

comment on column public.trade_ideas.idea_status is
  'Canonical user-facing Idea status. Archive remains the separate deleted_at lifecycle.';
comment on column public.catalysts.catalyst_category is
  'Refined OJ taxonomy. Null retains an ambiguous legacy event_type without guessing.';
comment on constraint trade_candidates_name_check on public.trade_candidates is
  'Candidate is canonical. Balanced and Aggressive remain accepted only for stored-record compatibility.';
comment on function public.save_trade_idea_edit(uuid,integer,jsonb,uuid,jsonb) is
  'Owner-scoped, revision-checked atomic edit for an active Idea and its canonical candidate. Does not mutate Trade provenance.';

commit;
