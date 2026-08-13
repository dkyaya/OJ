-- Phase 8.5 Catalyst Intelligence V1.
-- Extends the append-only Research Ledger with queryable provenance and keeps
-- provider response caching semantically separate from research observations.

begin;

alter table public.research_snapshots
  add column provider text not null default 'manual'
    check (char_length(btrim(provider)) between 1 and 80),
  add column source_quality text not null default 'unverified'
    check (source_quality in ('official', 'primary', 'secondary', 'unverified')),
  add column freshness text not null default 'manual'
    check (freshness in ('current', 'delayed', 'historical', 'manual')),
  add column fetched_at timestamptz not null default now(),
  add column source_reference text
    check (source_reference is null or char_length(btrim(source_reference)) <= 2000),
  add column session_label text
    check (session_label is null or session_label in ('T-5', 'T-3', 'T-1', 'T0', 'T+1', 'T+5')),
  add column source_date date,
  add column calendar_days_to_catalyst integer
    check (calendar_days_to_catalyst is null or calendar_days_to_catalyst between -3660 and 3660),
  add column catalyst_timezone text
    check (catalyst_timezone is null or char_length(btrim(catalyst_timezone)) between 1 and 80),
  add column catalyst_session text
    check (catalyst_session is null or catalyst_session in ('pre_market', 'regular', 'after_hours', 'all_day', 'unscheduled'));

create index research_snapshots_catalyst_session_idx
  on public.research_snapshots(catalyst_id, session_label, observed_at desc)
  where catalyst_id is not null;

create table public.catalyst_provider_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  capability text not null check (char_length(btrim(capability)) between 1 and 80),
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  request_fingerprint jsonb not null check (jsonb_typeof(request_fingerprint) = 'object'),
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) in ('object', 'array')),
  observed_at timestamptz,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  historical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

comment on table public.catalyst_provider_cache is
  'Service-only, user-partitioned normalized provider cache. Never a Research Ledger or browser-write table.';

alter table public.catalyst_provider_cache enable row level security;
revoke all on public.catalyst_provider_cache from public, anon, authenticated;
grant select, insert, update, delete on public.catalyst_provider_cache to service_role;

create index catalyst_provider_cache_expiry_idx
  on public.catalyst_provider_cache(expires_at);
create index catalyst_provider_cache_user_provider_idx
  on public.catalyst_provider_cache(user_id, provider, capability, fetched_at desc);

create trigger catalyst_provider_cache_set_updated_at
  before update on public.catalyst_provider_cache
  for each row execute function private.set_updated_at();

commit;
