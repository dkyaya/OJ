-- Keep privileged lifecycle work in a non-exposed trigger function.

create table public.trade_entry_requests (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_idea_id uuid not null,
  contracts integer not null check (contracts > 0),
  opened_at timestamptz not null,
  max_risk numeric(14, 2) not null check (max_risk > 0),
  entry_data jsonb not null check (jsonb_typeof(entry_data) = 'object'),
  confirmed_actual boolean not null check (confirmed_actual),
  created_at timestamptz not null default now(),
  constraint trade_entry_requests_idea_owner_fkey foreign key (trade_idea_id, user_id)
    references public.trade_ideas(id, user_id) on delete restrict
);

alter table public.trade_entry_requests enable row level security;
revoke all on table public.trade_entry_requests from anon, authenticated;
grant insert on table public.trade_entry_requests to authenticated;
create policy trade_entry_requests_owner_insert on public.trade_entry_requests for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user())
    and exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())));

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
end $$;

revoke all on function private.process_trade_entry_request() from public, anon, authenticated;
create trigger process_trade_entry_request after insert on public.trade_entry_requests
  for each row execute function private.process_trade_entry_request();

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
begin
  if owner_id is null then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit entry confirmation required'; end if;
  if p_contracts is null or p_contracts < 1 or p_opened_at is null or p_max_risk is null or p_max_risk <= 0 then raise exception 'invalid entry'; end if;
  if p_entry_data is null or jsonb_typeof(p_entry_data) <> 'object' then raise exception 'entry data must be an object'; end if;
  insert into public.trade_entry_requests(id, user_id, trade_idea_id, contracts, opened_at, max_risk, entry_data, confirmed_actual)
  values (trade_id, owner_id, p_trade_idea_id, p_contracts, p_opened_at, p_max_risk, p_entry_data, true);
  return trade_id;
end $$;

revoke all on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) from public, anon;
grant execute on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) to authenticated;

comment on table public.trade_entry_requests is 'Insert-only validated lifecycle commands. Private trigger creates the confirmed position atomically.';
