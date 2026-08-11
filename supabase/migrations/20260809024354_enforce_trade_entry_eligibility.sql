-- Rejected, deferred, and invalidated research cannot become a position.

create or replace function public.record_trade_entry(
  p_trade_idea_id uuid,
  p_contracts integer,
  p_opened_at timestamptz,
  p_max_risk numeric,
  p_entry_data jsonb,
  p_confirm_actual boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  idea public.trade_ideas%rowtype;
  trade_id uuid;
  maximum_open_risk numeric;
  current_open_risk numeric;
  research_status text;
begin
  if owner_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit entry confirmation required'; end if;
  if p_contracts is null or p_contracts < 1 or p_opened_at is null or p_max_risk is null or p_max_risk <= 0 then raise exception 'invalid entry'; end if;
  if p_entry_data is null or jsonb_typeof(p_entry_data) <> 'object' then raise exception 'entry data must be an object'; end if;

  select * into idea from public.trade_ideas where id = p_trade_idea_id and user_id = owner_id for update;
  if not found then raise exception 'trade idea not found'; end if;
  research_status := lower(coalesce(idea.data->>'Status', idea.data->>'status', 'watchlist'));
  if idea.entry_status <> 'not-entered' or idea.user_confirmed_fill then raise exception 'trade idea is not eligible for entry'; end if;
  if research_status in ('rejected','deferred','invalidated','draft') then raise exception 'trade idea must be watchlist or ready'; end if;

  select maximum_open_options_risk into maximum_open_risk from public.account_policies where user_id = owner_id for update;
  if maximum_open_risk is null then raise exception 'account risk policy required'; end if;
  select coalesce(sum(max_risk), 0) into current_open_risk from public.trades where user_id = owner_id and status = 'active' and deleted_at is null;
  if current_open_risk + p_max_risk > maximum_open_risk then raise exception 'entry exceeds maximum open options risk'; end if;

  insert into public.trades(user_id, trade_idea_id, ticker, strategy, status, contracts, max_risk, opened_at, confirmed_actual, data)
  values (owner_id, idea.id, idea.ticker, idea.strategy, 'active', p_contracts, p_max_risk, p_opened_at, true, p_entry_data)
  returning id into trade_id;
  insert into public.trade_entries(trade_idea_id, trade_id, user_id, data, confirmed_actual, record_status, revision, sync_status, source)
  values (idea.id, trade_id, owner_id, p_entry_data, true, 'confirmed', 1, 'cloud_draft', 'oj_app');
  update public.trade_ideas set entry_status = 'active', user_confirmed_fill = true, revision = revision + 1, updated_at = now()
  where id = idea.id and user_id = owner_id and revision = idea.revision;
  if not found then raise exception 'trade idea revision conflict'; end if;
  return trade_id;
end $$;

revoke all on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) from public, anon;
grant execute on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) to authenticated;
