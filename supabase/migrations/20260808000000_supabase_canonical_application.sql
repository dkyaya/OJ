-- Supabase becomes the canonical OJ application store.
-- Markdown/GitHub fields remain as optional mirror metadata only.

alter table public.account_policies
  add column if not exists fixed_per_trade_limit numeric(14, 2),
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;

alter table public.account_policies
  drop constraint if exists account_policies_fixed_per_trade_limit_check;
alter table public.account_policies
  add constraint account_policies_fixed_per_trade_limit_check
  check (fixed_per_trade_limit is null or (fixed_per_trade_limit > 0 and fixed_per_trade_limit <= maximum_open_options_risk));

alter table public.trade_ideas
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz,
  add column if not exists mirror_status text not null default 'not_requested';
alter table public.trade_ideas
  drop constraint if exists trade_ideas_mirror_status_check;
alter table public.trade_ideas
  add constraint trade_ideas_mirror_status_check
  check (mirror_status in ('not_requested','pending','current','stale','failed'));

alter table public.trade_candidates
  add column if not exists revision integer not null default 1,
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;
alter table public.trade_candidates
  drop constraint if exists trade_candidates_revision_check;
alter table public.trade_candidates
  add constraint trade_candidates_revision_check check (revision > 0);

alter table public.catalysts
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz,
  add column if not exists mirror_status text not null default 'not_requested';
alter table public.catalysts
  drop constraint if exists catalysts_mirror_status_check;
alter table public.catalysts
  add constraint catalysts_mirror_status_check
  check (mirror_status in ('not_requested','pending','current','stale','failed'));

alter table public.research_annotations
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;

alter table public.trade_entries
  add column if not exists trade_id uuid,
  add column if not exists record_status text not null default 'draft',
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;
alter table public.trade_checkins
  add column if not exists trade_id uuid,
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;
alter table public.trade_exits
  add column if not exists trade_id uuid,
  add column if not exists record_status text not null default 'draft',
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;
alter table public.journal_reviews
  add column if not exists source text not null default 'oj_app',
  add column if not exists source_path text,
  add column if not exists source_commit text,
  add column if not exists migrated_at timestamptz;

alter table public.trade_entries
  drop constraint if exists trade_entries_record_status_check,
  drop constraint if exists trade_entries_confirmation_check;
alter table public.trade_entries
  add constraint trade_entries_record_status_check check (record_status in ('draft','confirmed','void')),
  add constraint trade_entries_confirmation_check check (record_status <> 'confirmed' or confirmed_actual);
alter table public.trade_exits
  drop constraint if exists trade_exits_record_status_check,
  drop constraint if exists trade_exits_confirmation_check;
alter table public.trade_exits
  add constraint trade_exits_record_status_check check (record_status in ('draft','confirmed','void')),
  add constraint trade_exits_confirmation_check check (record_status <> 'confirmed' or confirmed_actual);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trade_idea_id uuid not null,
  ticker text not null check (ticker ~ '^[A-Za-z0-9._-]{1,20}$'),
  strategy text not null,
  status text not null default 'active' check (status in ('active','closed')),
  contracts integer not null check (contracts > 0),
  max_risk numeric(14, 2) check (max_risk is null or max_risk >= 0),
  opened_at timestamptz not null,
  closed_at timestamptz,
  confirmed_actual boolean not null default false,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1 check (revision > 0),
  source text not null default 'oj_app',
  source_path text,
  source_commit text,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trades_id_user_id_key unique (id, user_id),
  constraint trades_trade_idea_owner_fkey foreign key (trade_idea_id, user_id)
    references public.trade_ideas(id, user_id) on delete restrict,
  constraint trades_confirmation_check check (confirmed_actual),
  constraint trades_close_state_check check ((status = 'active' and closed_at is null) or (status = 'closed' and closed_at is not null))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trade_entries_trade_owner_fkey'
      and conrelid = 'public.trade_entries'::regclass
  ) then
    alter table public.trade_entries add constraint trade_entries_trade_owner_fkey
      foreign key (trade_id, user_id) references public.trades(id, user_id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'trade_checkins_trade_owner_fkey'
      and conrelid = 'public.trade_checkins'::regclass
  ) then
    alter table public.trade_checkins add constraint trade_checkins_trade_owner_fkey
      foreign key (trade_id, user_id) references public.trades(id, user_id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'trade_exits_trade_owner_fkey'
      and conrelid = 'public.trade_exits'::regclass
  ) then
    alter table public.trade_exits add constraint trade_exits_trade_owner_fkey
      foreign key (trade_id, user_id) references public.trades(id, user_id) on delete restrict;
  end if;
end $$;

create table public.application_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  calendar_view text not null default 'month' check (calendar_view in ('month','week','day')),
  compact_cards boolean not null default false,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.record_revisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  revision integer not null check (revision > 0),
  operation text not null check (operation in ('insert','update','migration')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, record_type, record_id, revision)
);

create table public.account_policy_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version integer not null check (policy_version > 0),
  total_account_capital numeric(14, 2) not null,
  maximum_open_options_risk numeric(14, 2) not null,
  fixed_per_trade_limit numeric(14, 2),
  preferred_defined_risk_strategies text[] not null default array[]::text[],
  effective_date date not null,
  source text not null,
  source_path text,
  source_commit text,
  recorded_at timestamptz not null default now(),
  unique (user_id, policy_version)
);

create table public.migration_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  source text not null check (source in ('obsidian_migration','oj_app','manual_import')),
  source_path text not null,
  source_commit text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  migrated_at timestamptz not null default now(),
  unique (user_id, source_path, source_commit)
);

alter table public.formalization_jobs
  add column if not exists job_purpose text not null default 'legacy_formalization',
  add column if not exists scope jsonb not null default '{}'::jsonb;
alter table public.formalization_jobs
  drop constraint if exists formalization_jobs_purpose_check;
alter table public.formalization_jobs
  add constraint formalization_jobs_purpose_check
  check (job_purpose in ('legacy_formalization','markdown_export','journal_mirror','full_journal_export'));

alter table public.trades enable row level security;
alter table public.application_preferences enable row level security;
alter table public.record_revisions enable row level security;
alter table public.account_policy_history enable row level security;
alter table public.migration_registry enable row level security;

revoke all on table public.trades, public.application_preferences, public.record_revisions,
  public.account_policy_history, public.migration_registry from anon, authenticated;
grant select, insert, update on table public.trades, public.application_preferences to authenticated;
grant select on table public.record_revisions, public.account_policy_history, public.migration_registry to authenticated;

create policy trades_owner_select on public.trades for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy trades_owner_insert on public.trades for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user())
    and exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())));
create policy trades_owner_update on public.trades for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()))
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user())
    and exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())));

create policy application_preferences_owner_select on public.application_preferences for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy application_preferences_owner_insert on public.application_preferences for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy application_preferences_owner_update on public.application_preferences for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()))
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));

create policy record_revisions_owner_select on public.record_revisions for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy account_policy_history_owner_select on public.account_policy_history for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy migration_registry_owner_select on public.migration_registry for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));

create or replace function private.guard_canonical_owned_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception 'record ownership is immutable';
    end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then
      raise exception 'canonical revisions must increment exactly once';
    end if;
  end if;
  return new;
end $$;

create or replace function private.guard_account_policy_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and tg_op = 'UPDATE' and new.policy_version is distinct from old.policy_version + 1 then
    raise exception 'policy versions must increment exactly once';
  end if;
  return new;
end $$;

create or replace function private.capture_record_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  record jsonb := to_jsonb(new);
  owner_id uuid := (record->>'user_id')::uuid;
  canonical_id uuid := coalesce((record->>'id')::uuid, owner_id);
  canonical_revision integer := coalesce((record->>'revision')::integer, (record->>'policy_version')::integer, 1);
begin
  insert into public.record_revisions(user_id, record_type, record_id, revision, operation, snapshot)
  values (owner_id, tg_table_name, canonical_id, canonical_revision, lower(tg_op), record)
  on conflict (user_id, record_type, record_id, revision) do nothing;
  return new;
end $$;

create or replace function private.capture_account_policy_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_policy_history(
    user_id, policy_version, total_account_capital, maximum_open_options_risk,
    fixed_per_trade_limit, preferred_defined_risk_strategies, effective_date,
    source, source_path, source_commit
  ) values (
    new.user_id, new.policy_version, new.total_account_capital, new.maximum_open_options_risk,
    new.fixed_per_trade_limit, new.preferred_defined_risk_strategies, new.effective_date,
    new.source, new.source_path, new.source_commit
  ) on conflict (user_id, policy_version) do nothing;
  return new;
end $$;

revoke all on function private.guard_canonical_owned_record() from public, anon, authenticated;
revoke all on function private.guard_account_policy_version() from public, anon, authenticated;
revoke all on function private.capture_record_revision() from public, anon, authenticated;
revoke all on function private.capture_account_policy_history() from public, anon, authenticated;

create trigger trades_guard before insert or update on public.trades
  for each row execute function private.guard_canonical_owned_record();
create trigger application_preferences_guard before insert or update on public.application_preferences
  for each row execute function private.guard_canonical_owned_record();
create trigger account_policies_version_guard before update on public.account_policies
  for each row execute function private.guard_account_policy_version();

create trigger trades_set_updated_at before update on public.trades
  for each row execute function private.set_updated_at();
create trigger application_preferences_set_updated_at before update on public.application_preferences
  for each row execute function private.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'trade_ideas','trade_candidates','catalysts','research_annotations','trades',
    'trade_entries','trade_checkins','trade_exits','journal_reviews','application_preferences'
  ] loop
    execute format('drop trigger if exists capture_record_revision on public.%I', table_name);
    execute format(
      'create trigger capture_record_revision after insert or update on public.%I for each row execute function private.capture_record_revision()',
      table_name
    );
  end loop;
end $$;

create trigger account_policies_history after insert or update on public.account_policies
  for each row execute function private.capture_account_policy_history();

create index trades_owner_status_updated_idx on public.trades(user_id, status, updated_at desc) where deleted_at is null;
create index trades_idea_owner_idx on public.trades(trade_idea_id, user_id) where deleted_at is null;
create index trade_entries_position_owner_idx on public.trade_entries(trade_id, user_id) where trade_id is not null;
create index trade_checkins_position_owner_idx on public.trade_checkins(trade_id, user_id) where trade_id is not null;
create index trade_exits_position_owner_idx on public.trade_exits(trade_id, user_id) where trade_id is not null;
create index record_revisions_record_idx on public.record_revisions(user_id, record_type, record_id, revision desc);
create index account_policy_history_owner_idx on public.account_policy_history(user_id, policy_version desc);
create index migration_registry_record_idx on public.migration_registry(user_id, record_type, record_id);

comment on table public.trades is 'Canonical confirmed option positions. Watchlist research remains in trade_ideas.';
comment on table public.record_revisions is 'Append-only owner-visible snapshots of canonical application records.';
comment on table public.migration_registry is 'Idempotent record of owner-authorized imports from optional mirrors.';
comment on table public.formalization_jobs is 'Legacy secure pipeline retained for optional Markdown mirror/export jobs; ordinary OJ saves do not depend on it.';

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
  idea public.trade_ideas%rowtype;
  trade_id uuid;
begin
  if owner_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if not p_confirm_actual then raise exception 'explicit entry confirmation required'; end if;
  if p_contracts is null or p_contracts < 1 or p_opened_at is null or p_max_risk is null or p_max_risk < 0 then raise exception 'invalid entry'; end if;
  select * into idea from public.trade_ideas where id = p_trade_idea_id and user_id = owner_id for update;
  if not found then raise exception 'trade idea not found'; end if;
  if idea.entry_status in ('entered','active','closed') then raise exception 'trade idea already entered'; end if;

  insert into public.trades(user_id, trade_idea_id, ticker, strategy, status, contracts, max_risk, opened_at, confirmed_actual, data)
  values (owner_id, idea.id, idea.ticker, idea.strategy, 'active', p_contracts, p_max_risk, p_opened_at, true, coalesce(p_entry_data, '{}'::jsonb))
  returning id into trade_id;

  insert into public.trade_entries(trade_idea_id, trade_id, user_id, data, confirmed_actual, record_status, revision, sync_status, source)
  values (idea.id, trade_id, owner_id, coalesce(p_entry_data, '{}'::jsonb), true, 'confirmed', 1, 'cloud_draft', 'oj_app');

  update public.trade_ideas set entry_status = 'active', user_confirmed_fill = true, revision = revision + 1, updated_at = now()
  where id = idea.id and user_id = owner_id and revision = idea.revision;
  return trade_id;
end $$;

revoke all on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) from public, anon;
grant execute on function public.record_trade_entry(uuid, integer, timestamptz, numeric, jsonb, boolean) to authenticated;
