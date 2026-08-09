-- Catalyst-first research, owner-scoped policy storage, and explicit defined-risk fields.
-- This migration intentionally contains schema only: the owner enters policy values after authentication.

create table public.account_policies (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_account_capital numeric(14, 2) not null check (total_account_capital > 0),
  maximum_open_options_risk numeric(14, 2) not null check (maximum_open_options_risk > 0 and maximum_open_options_risk <= total_account_capital),
  preferred_defined_risk_strategies text[] not null default array[]::text[],
  effective_date date not null default current_date,
  policy_version integer not null default 1 check (policy_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trade_ideas
  add column if not exists underlying_type text,
  add column if not exists originating_catalyst_id uuid,
  add column if not exists catalyst_cluster_id text,
  add column if not exists correlation_cluster text,
  add column if not exists planned_hold_through_events jsonb not null default '[]'::jsonb,
  add column if not exists planned_avoid_events jsonb not null default '[]'::jsonb,
  add column if not exists expected_move numeric,
  add column if not exists implied_move numeric,
  add column if not exists opportunity_scores jsonb not null default '{}'::jsonb,
  add column if not exists risk_capacity_before numeric(14, 2),
  add column if not exists risk_capacity_after numeric(14, 2),
  add column if not exists contracts integer,
  add column if not exists entry_status text not null default 'not-entered',
  add column if not exists user_confirmed_fill boolean not null default false;

alter table public.catalysts
  add column if not exists catalyst_cluster_id text,
  add column if not exists release_source text,
  add column if not exists source_verified_at timestamptz,
  add column if not exists expected_sensitivity text,
  add column if not exists research_status text not null default 'researching',
  add column if not exists opportunity_scores jsonb not null default '{}'::jsonb;

alter table public.trade_ideas
  drop constraint if exists trade_ideas_entry_status_check,
  drop constraint if exists trade_ideas_contracts_check,
  drop constraint if exists trade_ideas_hold_events_array_check,
  drop constraint if exists trade_ideas_avoid_events_array_check,
  drop constraint if exists trade_ideas_opportunity_scores_object_check,
  drop constraint if exists trade_ideas_confirmed_entry_check;

alter table public.trade_ideas
  add constraint trade_ideas_entry_status_check check (entry_status in ('not-entered', 'entered', 'active', 'closed', 'rejected', 'deferred')),
  add constraint trade_ideas_contracts_check check (contracts is null or contracts > 0),
  add constraint trade_ideas_hold_events_array_check check (jsonb_typeof(planned_hold_through_events) = 'array'),
  add constraint trade_ideas_avoid_events_array_check check (jsonb_typeof(planned_avoid_events) = 'array'),
  add constraint trade_ideas_opportunity_scores_object_check check (jsonb_typeof(opportunity_scores) = 'object'),
  add constraint trade_ideas_confirmed_entry_check check (entry_status not in ('entered', 'active', 'closed') or user_confirmed_fill);

alter table public.catalysts
  drop constraint if exists catalysts_opportunity_scores_object_check;
alter table public.catalysts
  add constraint catalysts_opportunity_scores_object_check check (jsonb_typeof(opportunity_scores) = 'object');

alter table public.catalysts
  add constraint catalysts_id_user_id_key unique (id, user_id);

alter table public.trade_ideas
  add constraint trade_ideas_originating_catalyst_owner_fkey
  foreign key (originating_catalyst_id, user_id) references public.catalysts(id, user_id) on delete restrict;

create table public.catalyst_security_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalyst_id uuid not null,
  trade_idea_id uuid,
  ticker text not null check (ticker ~ '^[A-Za-z0-9._-]{1,20}$'),
  exposure_type text not null check (exposure_type in ('direct', 'indirect', 'index', 'sector', 'rates', 'supply-chain', 'peer')),
  research_status text not null default 'researching',
  sensitivity text,
  correlation_cluster text,
  expected_move numeric,
  implied_move numeric,
  opportunity_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(opportunity_scores) = 'object'),
  rationale text,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1 check (revision > 0),
  sync_status public.oj_sync_status not null default 'cloud_draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint catalyst_security_mappings_catalyst_owner_fkey foreign key (catalyst_id, user_id) references public.catalysts(id, user_id) on delete restrict,
  constraint catalyst_security_mappings_trade_owner_fkey foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict
);

alter table public.account_policies enable row level security;
alter table public.catalyst_security_mappings enable row level security;

revoke all on table public.account_policies, public.catalyst_security_mappings from anon;
revoke all on table public.account_policies, public.catalyst_security_mappings from authenticated;
grant select, insert, update on table public.account_policies, public.catalyst_security_mappings to authenticated;

create policy account_policies_owner_select on public.account_policies for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy account_policies_owner_insert on public.account_policies for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy account_policies_owner_update on public.account_policies for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()))
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));

create policy catalyst_security_mappings_owner_select on public.catalyst_security_mappings for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (select 1 from public.catalysts parent where parent.id = catalyst_id and parent.user_id = (select auth.uid()))
  );
create policy catalyst_security_mappings_owner_insert on public.catalyst_security_mappings for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (select 1 from public.catalysts parent where parent.id = catalyst_id and parent.user_id = (select auth.uid()))
    and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())))
  );
create policy catalyst_security_mappings_owner_update on public.catalyst_security_mappings for update to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (select 1 from public.catalysts parent where parent.id = catalyst_id and parent.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and (select private.is_approved_user())
    and exists (select 1 from public.catalysts parent where parent.id = catalyst_id and parent.user_id = (select auth.uid()))
    and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())))
  );

create trigger account_policies_user_id_immutable before update on public.account_policies
  for each row execute function private.guard_owned_record_user_id();
create trigger catalyst_security_mappings_user_id_immutable before update on public.catalyst_security_mappings
  for each row execute function private.guard_owned_record_user_id();
create trigger catalyst_security_mappings_browser_state before insert or update on public.catalyst_security_mappings
  for each row execute function private.guard_browser_draft_state();
create trigger account_policies_set_updated_at before update on public.account_policies
  for each row execute function private.set_updated_at();
create trigger catalyst_security_mappings_set_updated_at before update on public.catalyst_security_mappings
  for each row execute function private.set_updated_at();

create index account_policies_effective_date_idx on public.account_policies(effective_date desc);
create index trade_ideas_originating_catalyst_owner_idx on public.trade_ideas(originating_catalyst_id, user_id) where originating_catalyst_id is not null;
create index trade_ideas_correlation_cluster_owner_idx on public.trade_ideas(user_id, correlation_cluster) where correlation_cluster is not null;
create index catalysts_cluster_owner_idx on public.catalysts(user_id, catalyst_cluster_id) where catalyst_cluster_id is not null;
create index catalyst_security_mappings_catalyst_owner_idx on public.catalyst_security_mappings(catalyst_id, user_id) where deleted_at is null;
create index catalyst_security_mappings_trade_owner_idx on public.catalyst_security_mappings(trade_idea_id, user_id) where trade_idea_id is not null and deleted_at is null;
create index catalyst_security_mappings_cluster_owner_idx on public.catalyst_security_mappings(user_id, correlation_cluster) where correlation_cluster is not null and deleted_at is null;

