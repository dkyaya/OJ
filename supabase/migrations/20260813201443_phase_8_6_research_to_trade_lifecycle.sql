begin;

-- Phase 8.6 keeps the existing Idea/Candidate/Trade model and adds only the
-- typed lifecycle fields needed for immutable entry context, monitoring, exit,
-- and debrief continuity.

alter table public.trades
  add column if not exists candidate_id uuid,
  add column if not exists trade_class text,
  add column if not exists expiration date,
  add column if not exists long_strike numeric(14, 4),
  add column if not exists short_strike numeric(14, 4),
  add column if not exists actual_debit numeric(14, 4),
  add column if not exists entry_fees numeric(14, 2) not null default 0,
  add column if not exists max_profit numeric(14, 2),
  add column if not exists break_even numeric(14, 4),
  add column if not exists originating_catalyst_id uuid,
  add column if not exists exposure_tags text[] not null default array[]::text[],
  add column if not exists entry_context jsonb;

alter table public.trade_candidates
  add constraint trade_candidates_id_user_id_key unique (id, user_id);

alter table public.trades
  drop constraint if exists trades_candidate_owner_fkey,
  add constraint trades_candidate_owner_fkey foreign key (candidate_id, user_id)
    references public.trade_candidates(id, user_id) on delete restrict,
  drop constraint if exists trades_originating_catalyst_owner_fkey,
  add constraint trades_originating_catalyst_owner_fkey foreign key (originating_catalyst_id, user_id)
    references public.catalysts(id, user_id) on delete restrict,
  drop constraint if exists trades_trade_class_check,
  add constraint trades_trade_class_check check (trade_class is null or trade_class in ('pre_catalyst_anticipation','catalyst_hold','post_catalyst_confirmation')),
  drop constraint if exists trades_vertical_check,
  add constraint trades_vertical_check check (
    (expiration is null and long_strike is null and short_strike is null and actual_debit is null and entry_context is null)
    or (expiration is not null and long_strike is not null and short_strike is not null and actual_debit > 0
      and actual_debit < abs(short_strike-long_strike) and jsonb_typeof(entry_context)='object')
  ),
  drop constraint if exists trades_entry_fees_check,
  add constraint trades_entry_fees_check check (entry_fees >= 0),
  drop constraint if exists trades_entry_context_version_check,
  add constraint trades_entry_context_version_check check (entry_context is null or (entry_context->>'version')::integer = 1);

alter table public.trade_checkins
  add column if not exists thesis_health text,
  add column if not exists checked_at timestamptz,
  add column if not exists current_management_view text;
alter table public.trade_checkins
  drop constraint if exists trade_checkins_thesis_health_check,
  add constraint trade_checkins_thesis_health_check check (thesis_health is null or thesis_health in ('stronger','intact','weaker','invalidated')),
  drop constraint if exists trade_checkins_trade_required_check,
  add constraint trade_checkins_trade_required_check check (trade_id is not null or migrated_at is not null);

alter table public.trade_exits
  add column if not exists exited_at timestamptz,
  add column if not exists contracts_exited integer,
  add column if not exists exit_value numeric(14, 4),
  add column if not exists exit_value_type text,
  add column if not exists fees numeric(14, 2) not null default 0,
  add column if not exists realized_pnl numeric(14, 2),
  add column if not exists exit_reason text,
  add column if not exists thesis_health_at_exit text,
  add column if not exists catalyst_relationship text;
alter table public.trade_exits
  drop constraint if exists trade_exits_contracts_check,
  add constraint trade_exits_contracts_check check (contracts_exited is null or contracts_exited > 0),
  drop constraint if exists trade_exits_value_check,
  add constraint trade_exits_value_check check (exit_value is null or exit_value >= 0),
  drop constraint if exists trade_exits_value_type_check,
  add constraint trade_exits_value_type_check check (exit_value_type is null or exit_value_type in ('credit','debit')),
  drop constraint if exists trade_exits_fees_check,
  add constraint trade_exits_fees_check check (fees >= 0),
  drop constraint if exists trade_exits_reason_check,
  add constraint trade_exits_reason_check check (exit_reason is null or exit_reason in ('target_reached','thesis_invalidated','catalyst_approaching','risk_reduction','time_decay','volatility_change','better_opportunity','manual_other')),
  drop constraint if exists trade_exits_thesis_health_check,
  add constraint trade_exits_thesis_health_check check (thesis_health_at_exit is null or thesis_health_at_exit in ('stronger','intact','weaker','invalidated'));

alter table public.journal_reviews add column if not exists trade_id uuid;
alter table public.journal_reviews
  drop constraint if exists journal_reviews_trade_owner_fkey,
  add constraint journal_reviews_trade_owner_fkey foreign key (trade_id, user_id)
    references public.trades(id, user_id) on delete restrict;

create index if not exists trades_candidate_owner_idx on public.trades(candidate_id, user_id) where candidate_id is not null;
create index if not exists trades_originating_catalyst_owner_idx on public.trades(originating_catalyst_id, user_id) where originating_catalyst_id is not null;
create index if not exists trade_checkins_trade_checked_idx on public.trade_checkins(trade_id, checked_at desc) where trade_id is not null;
create index if not exists trade_exits_trade_exited_idx on public.trade_exits(trade_id, exited_at desc) where trade_id is not null;
create index if not exists journal_reviews_trade_owner_idx on public.journal_reviews(trade_id, user_id) where trade_id is not null;

create or replace function public.save_trade_idea_edit(p_trade_idea_id uuid,p_expected_revision integer,p_record jsonb,p_candidate_id uuid,p_candidate jsonb)
returns public.trade_ideas language plpgsql security invoker set search_path='' as $$
declare owner_id uuid := (select auth.uid()); idea public.trade_ideas; saved_idea public.trade_ideas; candidate public.trade_candidates; candidate_data jsonb; candidate_changed boolean := false;
begin
  if owner_id is null or not (select private.is_approved_user()) then raise exception 'approved account required'; end if;
  if p_trade_idea_id is null or p_expected_revision is null or p_expected_revision<1 or p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'invalid Idea edit request'; end if;
  select * into idea from public.trade_ideas where id=p_trade_idea_id and user_id=owner_id for update;
  if not found then raise exception 'trade idea not found'; end if;
  if idea.deleted_at is not null then raise exception 'restore the archived idea before editing it'; end if;
  if idea.revision<>p_expected_revision then raise exception 'trade idea changed on another device'; end if;
  if lower(coalesce(p_record->>'idea_status','')) not in ('watchlist','ready','deferred','draft','rejected','invalidated') then raise exception 'invalid Idea status'; end if;
  if lower(coalesce(p_record->>'strategy','')) not in ('bull-call-spread','bear-put-spread') then raise exception 'invalid Idea strategy'; end if;
  if char_length(btrim(coalesce(p_record->>'ticker',''))) not between 1 and 20 then raise exception 'invalid Idea ticker'; end if;
  update public.trade_ideas set ticker=upper(btrim(p_record->>'ticker')),underlying_type=nullif(btrim(p_record->>'underlying_type'),''),strategy=lower(p_record->>'strategy'),bias=btrim(p_record->>'bias'),idea_status=lower(p_record->>'idea_status'),confidence=nullif(btrim(p_record->>'confidence'),''),originating_catalyst_id=nullif(p_record->>'originating_catalyst_id','')::uuid,planned_hold_through_events=coalesce(p_record->'planned_hold_through_events','[]'::jsonb),planned_avoid_events=coalesce(p_record->'planned_avoid_events','[]'::jsonb),contracts=nullif(p_record->>'contracts','')::integer,data=coalesce(p_record->'data','{}'::jsonb),revision=idea.revision+1,sync_status='cloud_draft',source='oj_app',updated_at=now()
    where id=idea.id and user_id=owner_id and revision=idea.revision returning * into saved_idea;
  if p_candidate is not null and coalesce((p_candidate->>'enabled')::boolean,false) then
    candidate_data := jsonb_build_object('label','Candidate','expiration',p_candidate->'expiration','long_strike',p_candidate->'long_strike','short_strike',p_candidate->'short_strike','debit',p_candidate->'debit','contracts',p_candidate->'contracts','max_loss',p_candidate->'max_loss','max_profit',p_candidate->'max_profit','break_even',p_candidate->'break_even');
    select * into candidate from public.trade_candidates where id=p_candidate_id and user_id=owner_id for update;
    if found then
      if candidate.trade_idea_id<>idea.id then raise exception 'candidate does not belong to this Idea'; end if;
      candidate_changed := candidate.data is distinct from candidate_data;
      if candidate_changed then update public.trade_candidates set name='Candidate',data=candidate_data,revision=candidate.revision+1,source='oj_app',updated_at=now() where id=candidate.id and user_id=owner_id and revision=candidate.revision; end if;
    else
      insert into public.trade_candidates(id,trade_idea_id,user_id,name,data,revision,source) values (p_candidate_id,idea.id,owner_id,'Candidate',candidate_data,1,'oj_app');
    end if;
  end if;
  return saved_idea;
end $$;
revoke all on function public.save_trade_idea_edit(uuid,integer,jsonb,uuid,jsonb) from public, anon;
grant execute on function public.save_trade_idea_edit(uuid,integer,jsonb,uuid,jsonb) to authenticated;

create or replace function private.guard_trade_history_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role','postgres','supabase_admin') then
    if new.trade_idea_id is distinct from old.trade_idea_id
       or new.opened_at is distinct from old.opened_at
       or new.confirmed_actual is distinct from old.confirmed_actual
       or new.candidate_id is distinct from old.candidate_id
       or new.trade_class is distinct from old.trade_class
       or new.expiration is distinct from old.expiration
       or new.long_strike is distinct from old.long_strike
       or new.short_strike is distinct from old.short_strike
       or new.actual_debit is distinct from old.actual_debit
       or new.entry_fees is distinct from old.entry_fees
       or new.max_risk is distinct from old.max_risk
       or new.max_profit is distinct from old.max_profit
       or new.break_even is distinct from old.break_even
       or new.entry_context is distinct from old.entry_context then
      raise exception 'trade entry history is immutable';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_trade_history_immutable() from public, anon, authenticated;
drop trigger if exists trade_history_immutable on public.trades;
create trigger trade_history_immutable before update on public.trades
  for each row execute function private.guard_trade_history_immutable();

-- Check-ins are observations. Corrections are new check-ins, never rewrites.
revoke insert, update, delete on table public.trades, public.trade_entries, public.trade_checkins, public.trade_exits from authenticated;
grant select on table public.trades, public.trade_entries, public.trade_checkins, public.trade_exits to authenticated;

create or replace function private.record_trade_entry_v2_impl(
  p_trade_idea_id uuid,
  p_candidate_id uuid,
  p_trade_class text,
  p_expiration date,
  p_long_strike numeric,
  p_short_strike numeric,
  p_contracts integer,
  p_opened_at timestamptz,
  p_actual_debit numeric,
  p_fees numeric,
  p_notes text,
  p_confirm_actual boolean,
  p_risk_acknowledged boolean default false,
  p_risk_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid());
  idea public.trade_ideas%rowtype;
  candidate public.trade_candidates%rowtype;
  trade_id uuid := gen_random_uuid();
  width numeric;
  max_loss numeric;
  max_profit numeric;
  break_even numeric;
  ceiling numeric;
  policy_version integer;
  current_open_risk numeric;
  context jsonb;
  linked_catalysts jsonb;
  research_ids jsonb;
  forecast_ids jsonb;
begin
  if owner_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit entry confirmation required'; end if;
  if p_trade_class not in ('pre_catalyst_anticipation','catalyst_hold','post_catalyst_confirmation') then raise exception 'invalid trade class'; end if;
  if p_expiration is null or p_opened_at is null or p_expiration < p_opened_at::date or p_contracts < 1 or p_actual_debit <= 0 or coalesce(p_fees,0) < 0 then raise exception 'invalid entry'; end if;

  select * into idea from public.trade_ideas where id=p_trade_idea_id and user_id=owner_id for update;
  if not found or idea.deleted_at is not null then raise exception 'eligible trade idea not found'; end if;
  if idea.entry_status <> 'not-entered' or idea.user_confirmed_fill then raise exception 'trade idea is not eligible for entry'; end if;
  if idea.idea_status not in ('watchlist','ready') then raise exception 'trade idea must be watchlist or ready'; end if;

  if p_candidate_id is not null then
    select * into candidate from public.trade_candidates where id=p_candidate_id and trade_idea_id=idea.id and user_id=owner_id;
    if not found then raise exception 'candidate does not belong to this Idea'; end if;
  end if;

  if idea.strategy='bull-call-spread' and p_long_strike >= p_short_strike then raise exception 'bull call long strike must be below short strike'; end if;
  if idea.strategy='bear-put-spread' and p_long_strike <= p_short_strike then raise exception 'bear put long strike must be above short strike'; end if;
  width := abs(p_short_strike-p_long_strike);
  if width <= 0 or p_actual_debit >= width then raise exception 'debit must be below spread width'; end if;
  max_loss := round(p_actual_debit*100*p_contracts,2);
  max_profit := round((width-p_actual_debit)*100*p_contracts,2);
  break_even := case when idea.strategy='bull-call-spread' then p_long_strike+p_actual_debit else p_long_strike-p_actual_debit end;

  select maximum_open_options_risk, account_policies.policy_version into ceiling, policy_version from public.account_policies where user_id=owner_id for update;
  if ceiling is null then raise exception 'account risk policy required'; end if;
  select coalesce(sum(max_risk),0) into current_open_risk from public.trades where user_id=owner_id and status='active' and deleted_at is null;
  if current_open_risk+max_loss > ceiling and (not coalesce(p_risk_acknowledged,false) or nullif(btrim(coalesce(p_risk_note,'')),'') is null) then
    raise exception 'risk ceiling acknowledgement and note required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('catalyst_id',catalyst_id,'relationship',relationship) order by created_at),'[]'::jsonb)
    into linked_catalysts from public.trade_idea_catalysts where trade_idea_id=idea.id and user_id=owner_id;
  select coalesce(jsonb_agg(id order by observed_at desc),'[]'::jsonb) into research_ids
    from (select id,observed_at from public.research_snapshots where user_id=owner_id and trade_idea_id=idea.id and observed_at<=p_opened_at order by observed_at desc limit 6) s;
  select coalesce(jsonb_agg(id order by created_at desc),'[]'::jsonb) into forecast_ids
    from (select id,created_at from public.personal_forecasts where user_id=owner_id and catalyst_id=idea.originating_catalyst_id and locked_at is not null and locked_at<=p_opened_at order by created_at desc limit 3) f;

  context := jsonb_strip_nulls(jsonb_build_object(
    'version',1,'captured_at',now(),'idea_id',idea.id,'idea_revision',idea.revision,'idea_status',idea.idea_status,'research_stage',idea.research_stage,
    'asset_type',idea.underlying_type,'bias',idea.bias,'thesis',coalesce(idea.data->>'Thesis',idea.data->>'thesis'),'evidence',coalesce(idea.data->>'Evidence',idea.data->>'evidence'),
    'entry_conditions',coalesce(idea.data->>'Entry conditions',idea.data->>'Entry Conditions'),'invalidation',coalesce(idea.data->>'Invalidation',idea.data->>'invalidation'),
    'planned_exit',coalesce(idea.data->>'Planned exit',idea.data->>'Exit plan',idea.data->>'Planned Exit'),'hold_through_events',idea.planned_hold_through_events,'avoid_events',idea.planned_avoid_events,
    'candidate',case when p_candidate_id is null then null else jsonb_build_object('id',candidate.id,'revision',candidate.revision,'expiration',candidate.data->'expiration','long_strike',candidate.data->'long_strike','short_strike',candidate.data->'short_strike','planned_debit',candidate.data->'debit','planned_contracts',candidate.data->'contracts','planned_max_loss',candidate.data->'max_loss','planned_max_profit',candidate.data->'max_profit','planned_break_even',candidate.data->'break_even') end,
    'actual',jsonb_build_object('expiration',p_expiration,'long_strike',p_long_strike,'short_strike',p_short_strike,'contracts',p_contracts,'debit',p_actual_debit,'fees',coalesce(p_fees,0),'max_loss',max_loss,'max_profit',max_profit,'break_even',break_even),
    'originating_catalyst_id',idea.originating_catalyst_id,'catalyst_cluster',idea.catalyst_cluster_id,'linked_catalysts',linked_catalysts,'research_snapshot_ids',research_ids,'forecast_ids',forecast_ids,'trade_class',p_trade_class,'exposure_tags',to_jsonb(idea.exposure_tags),
    'risk_policy',jsonb_build_object('version',policy_version,'ceiling',ceiling,'open_risk_before',current_open_risk,'projected_open_risk',current_open_risk+max_loss,'overshoot_acknowledged',coalesce(p_risk_acknowledged,false),'overshoot_note',nullif(btrim(coalesce(p_risk_note,'')),''))
  ));

  insert into public.trades(id,user_id,trade_idea_id,candidate_id,ticker,strategy,status,contracts,max_risk,max_profit,break_even,opened_at,confirmed_actual,data,trade_class,expiration,long_strike,short_strike,actual_debit,entry_fees,originating_catalyst_id,exposure_tags,entry_context)
  values (trade_id,owner_id,idea.id,p_candidate_id,idea.ticker,idea.strategy,'active',p_contracts,max_loss,max_profit,break_even,p_opened_at,true,jsonb_strip_nulls(jsonb_build_object('debit',p_actual_debit,'fees',coalesce(p_fees,0),'notes',nullif(btrim(coalesce(p_notes,'')),''))),p_trade_class,p_expiration,p_long_strike,p_short_strike,p_actual_debit,coalesce(p_fees,0),idea.originating_catalyst_id,idea.exposure_tags,context);
  insert into public.trade_entries(trade_idea_id,trade_id,user_id,data,confirmed_actual,record_status,revision,sync_status,source)
  values (idea.id,trade_id,owner_id,jsonb_build_object('entry_context',context),true,'confirmed',1,'cloud_draft','oj_app');
  update public.trade_ideas set entry_status='active',user_confirmed_fill=true,research_stage='entered',revision=revision+1,updated_at=now()
    where id=idea.id and user_id=owner_id and revision=idea.revision;
  if not found then raise exception 'trade idea revision conflict'; end if;
  return trade_id;
end $$;

revoke all on function private.record_trade_entry_v2_impl(uuid,uuid,text,date,numeric,numeric,integer,timestamptz,numeric,numeric,text,boolean,boolean,text) from public, anon;
grant execute on function private.record_trade_entry_v2_impl(uuid,uuid,text,date,numeric,numeric,integer,timestamptz,numeric,numeric,text,boolean,boolean,text) to authenticated;

create or replace function public.record_trade_entry_v2(
  p_trade_idea_id uuid,p_candidate_id uuid,p_trade_class text,p_expiration date,p_long_strike numeric,p_short_strike numeric,p_contracts integer,p_opened_at timestamptz,p_actual_debit numeric,p_fees numeric,p_notes text,p_confirm_actual boolean,p_risk_acknowledged boolean default false,p_risk_note text default null
) returns uuid language sql security invoker set search_path='' as $$
  select private.record_trade_entry_v2_impl(p_trade_idea_id,p_candidate_id,p_trade_class,p_expiration,p_long_strike,p_short_strike,p_contracts,p_opened_at,p_actual_debit,p_fees,p_notes,p_confirm_actual,p_risk_acknowledged,p_risk_note)
$$;
revoke all on function public.record_trade_entry_v2(uuid,uuid,text,date,numeric,numeric,integer,timestamptz,numeric,numeric,text,boolean,boolean,text) from public, anon;
grant execute on function public.record_trade_entry_v2(uuid,uuid,text,date,numeric,numeric,integer,timestamptz,numeric,numeric,text,boolean,boolean,text) to authenticated;

create or replace function private.record_trade_checkin_impl(p_trade_id uuid,p_thesis_health text,p_checked_at timestamptz,p_changes jsonb,p_management_view text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid := (select auth.uid()); trade public.trades%rowtype; checkin_id uuid := gen_random_uuid();
begin
  if owner_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if p_thesis_health not in ('stronger','intact','weaker','invalidated') or p_checked_at is null or p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'invalid check-in'; end if;
  select * into trade from public.trades where id=p_trade_id and user_id=owner_id and deleted_at is null for update;
  if not found or trade.status<>'active' then raise exception 'active trade not found'; end if;
  insert into public.trade_checkins(id,trade_idea_id,trade_id,user_id,data,thesis_health,checked_at,current_management_view,revision,sync_status,source)
  values (checkin_id,trade.trade_idea_id,trade.id,owner_id,p_changes,p_thesis_health,p_checked_at,nullif(btrim(coalesce(p_management_view,'')),''),1,'cloud_draft','oj_app');
  return checkin_id;
end $$;
revoke all on function private.record_trade_checkin_impl(uuid,text,timestamptz,jsonb,text) from public, anon;
grant execute on function private.record_trade_checkin_impl(uuid,text,timestamptz,jsonb,text) to authenticated;

create or replace function public.record_trade_checkin(p_trade_id uuid,p_thesis_health text,p_checked_at timestamptz,p_changes jsonb,p_management_view text)
returns uuid language sql security invoker set search_path='' as $$
  select private.record_trade_checkin_impl(p_trade_id,p_thesis_health,p_checked_at,p_changes,p_management_view)
$$;
revoke all on function public.record_trade_checkin(uuid,text,timestamptz,jsonb,text) from public, anon;
grant execute on function public.record_trade_checkin(uuid,text,timestamptz,jsonb,text) to authenticated;

create table public.trade_exit_requests (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_id uuid not null,
  exited_at timestamptz not null,
  exit_value numeric(14,4) not null check (exit_value>=0),
  exit_value_type text not null check (exit_value_type in ('credit','debit')),
  fees numeric(14,2) not null default 0 check (fees>=0),
  exit_reason text not null check (exit_reason in ('target_reached','thesis_invalidated','catalyst_approaching','risk_reduction','time_decay','volatility_change','better_opportunity','manual_other')),
  thesis_health text not null check (thesis_health in ('stronger','intact','weaker','invalidated')),
  catalyst_relationship text,
  notes text,
  confirmed_actual boolean not null check (confirmed_actual),
  created_at timestamptz not null default now(),
  constraint trade_exit_requests_trade_owner_fkey foreign key (trade_id,user_id) references public.trades(id,user_id) on delete restrict
);
alter table public.trade_exit_requests enable row level security;
revoke all on table public.trade_exit_requests from anon, authenticated;
grant insert on table public.trade_exit_requests to authenticated;
create policy trade_exit_requests_owner_insert on public.trade_exit_requests for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid())=user_id and (select private.is_approved_user()));

create or replace function private.process_trade_exit_request()
returns trigger language plpgsql security definer set search_path='' as $$
declare trade public.trades%rowtype; pnl numeric;
begin
  if (select auth.uid()) is null or new.user_id<>(select auth.uid()) or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  select * into trade from public.trades where id=new.trade_id and user_id=new.user_id for update;
  if not found or trade.status<>'active' then raise exception 'active trade not found'; end if;
  if new.exited_at<trade.opened_at then raise exception 'exit cannot precede entry'; end if;
  pnl := round(((case when new.exit_value_type='credit' then new.exit_value else -new.exit_value end)-trade.actual_debit)*100*trade.contracts-trade.entry_fees-new.fees,2);
  insert into public.trade_exits(id,trade_idea_id,trade_id,user_id,data,confirmed_actual,record_status,revision,sync_status,source,exited_at,contracts_exited,exit_value,exit_value_type,fees,realized_pnl,exit_reason,thesis_health_at_exit,catalyst_relationship)
  values (new.id,trade.trade_idea_id,trade.id,new.user_id,jsonb_strip_nulls(jsonb_build_object('notes',nullif(btrim(coalesce(new.notes,'')),''))),true,'confirmed',1,'cloud_draft','oj_app',new.exited_at,trade.contracts,new.exit_value,new.exit_value_type,new.fees,pnl,new.exit_reason,new.thesis_health,new.catalyst_relationship);
  update public.trades set status='closed',closed_at=new.exited_at,revision=revision+1,updated_at=now() where id=trade.id and user_id=new.user_id and revision=trade.revision;
  update public.trade_ideas set entry_status='closed',research_stage='exited',revision=revision+1,updated_at=now() where id=trade.trade_idea_id and user_id=new.user_id;
  return new;
end $$;
revoke all on function private.process_trade_exit_request() from public, anon, authenticated;
create trigger process_trade_exit_request after insert on public.trade_exit_requests for each row execute function private.process_trade_exit_request();

create or replace function public.record_trade_exit(p_trade_id uuid,p_exited_at timestamptz,p_exit_value numeric,p_exit_value_type text,p_fees numeric,p_exit_reason text,p_thesis_health text,p_catalyst_relationship text,p_notes text,p_confirm_actual boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare owner_id uuid := (select auth.uid()); exit_id uuid := gen_random_uuid();
begin
  if owner_id is null then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit exit confirmation required'; end if;
  insert into public.trade_exit_requests(id,user_id,trade_id,exited_at,exit_value,exit_value_type,fees,exit_reason,thesis_health,catalyst_relationship,notes,confirmed_actual)
  values (exit_id,owner_id,p_trade_id,p_exited_at,p_exit_value,p_exit_value_type,coalesce(p_fees,0),p_exit_reason,p_thesis_health,nullif(btrim(coalesce(p_catalyst_relationship,'')),''),nullif(btrim(coalesce(p_notes,'')),''),true);
  return exit_id;
end $$;
revoke all on function public.record_trade_exit(uuid,timestamptz,numeric,text,numeric,text,text,text,text,boolean) from public, anon;
grant execute on function public.record_trade_exit(uuid,timestamptz,numeric,text,numeric,text,text,text,text,boolean) to authenticated;

comment on column public.trades.entry_context is 'Immutable versioned snapshot of Idea/Candidate/research provenance and actual execution at confirmed entry.';
comment on column public.trades.trade_class is 'User-selected entry intention; never inferred solely from timestamps.';
comment on table public.trade_exit_requests is 'Insert-only confirmed exit commands. Private trigger closes the position and creates immutable exit history atomically.';

commit;
