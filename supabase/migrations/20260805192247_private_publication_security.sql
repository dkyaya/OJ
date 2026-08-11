-- Separate private canonical publication from the public app and enforce relational ownership.

alter table public.trade_ideas
  add constraint trade_ideas_id_user_id_key unique (id, user_id);
alter table public.formalization_jobs
  add constraint formalization_jobs_id_user_id_key unique (id, user_id);

alter table public.trade_candidates drop constraint trade_candidates_trade_idea_id_fkey;
alter table public.trade_candidates add constraint trade_candidates_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.catalysts drop constraint catalysts_trade_idea_id_fkey;
alter table public.catalysts add constraint catalysts_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.research_annotations drop constraint research_annotations_trade_idea_id_fkey;
alter table public.research_annotations add constraint research_annotations_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.trade_entries drop constraint trade_entries_trade_idea_id_fkey;
alter table public.trade_entries add constraint trade_entries_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.trade_checkins drop constraint trade_checkins_trade_idea_id_fkey;
alter table public.trade_checkins add constraint trade_checkins_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.trade_exits drop constraint trade_exits_trade_idea_id_fkey;
alter table public.trade_exits add constraint trade_exits_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.journal_reviews drop constraint journal_reviews_trade_idea_id_fkey;
alter table public.journal_reviews add constraint journal_reviews_trade_idea_owner_fkey
  foreign key (trade_idea_id, user_id) references public.trade_ideas(id, user_id) on delete restrict;
alter table public.formalization_payloads drop constraint formalization_payloads_job_id_fkey;
alter table public.formalization_payloads add constraint formalization_payloads_job_owner_fkey
  foreign key (job_id, user_id) references public.formalization_jobs(id, user_id) on delete restrict;

alter table public.formalization_jobs
  add column payload_hash text,
  add column canonical_commit_sha text,
  add column published_at timestamptz;
alter table public.formalization_payloads
  add column published_commit_sha text,
  add column published_at timestamptz;
alter table public.published_records
  add column payload_revision integer,
  add column payload_hash text,
  add column canonical jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now();

create table private.reconciliation_nonces (
  nonce uuid primary key,
  job_id uuid not null,
  received_at timestamptz not null default now()
);
alter table private.reconciliation_nonces enable row level security;
revoke all on table private.reconciliation_nonces from public, anon, authenticated;
grant select, insert, delete on table private.reconciliation_nonces to service_role;

create index formalization_jobs_record_owner_idx on public.formalization_jobs(record_type, record_id, user_id);
create index published_records_record_owner_idx on public.published_records(record_type, record_id, user_id);
create index reconciliation_nonces_received_at_idx on private.reconciliation_nonces(received_at);

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and approved is true
    )
$$;
revoke all on function private.is_approved_user() from public, anon;
grant execute on function private.is_approved_user() to authenticated, service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, approved)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();
drop function if exists public.handle_new_user();

create or replace function private.guard_profile_privileges()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and (new.id is distinct from old.id or new.approved is distinct from old.approved or new.email is distinct from old.email) then
    raise exception 'profile fields are server-managed';
  end if;
  return new;
end $$;
create or replace function private.guard_trade_idea_privileges()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and (new.user_id is distinct from old.user_id
      or new.published_record_id is distinct from old.published_record_id
      or new.published_commit_sha is distinct from old.published_commit_sha
      or new.published_note_path is distinct from old.published_note_path
      or new.last_submitted_at is distinct from old.last_submitted_at
      or new.last_published_at is distinct from old.last_published_at) then
    raise exception 'ownership and publication fields are server-managed';
  end if;
  return new;
end $$;
create or replace function private.guard_owned_record_user_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and new.user_id is distinct from old.user_id then
    raise exception 'record ownership is immutable';
  end if;
  return new;
end $$;
create or replace function private.guard_browser_draft_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.sync_status is distinct from 'cloud_draft'::public.oj_sync_status then raise exception 'browser writes may only produce cloud_draft state'; end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then raise exception 'browser revisions must increment exactly once'; end if;
    if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at then raise exception 'archive state is server-managed'; end if;
  end if;
  return new;
end $$;
create or replace function private.guard_browser_revision_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.sync_status is distinct from 'cloud_draft'::public.oj_sync_status then raise exception 'browser writes may only produce cloud_draft state'; end if;
    if tg_op = 'UPDATE' and new.revision is distinct from old.revision + 1 then raise exception 'browser revisions must increment exactly once'; end if;
  end if;
  return new;
end $$;
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function private.guard_profile_privileges() from public, anon, authenticated;
revoke all on function private.guard_trade_idea_privileges() from public, anon, authenticated;
revoke all on function private.guard_owned_record_user_id() from public, anon, authenticated;
revoke all on function private.guard_browser_draft_state() from public, anon, authenticated;
revoke all on function private.guard_browser_revision_state() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','trade_ideas','trade_candidates','catalysts','research_annotations','trade_entries','trade_checkins','trade_exits','journal_reviews','formalization_jobs','formalization_payloads','sync_events','published_records'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
  end loop;
  drop policy if exists profiles_self_select on public.profiles;
  drop policy if exists profiles_self_update on public.profiles;
  drop policy if exists jobs_owner_select on public.formalization_jobs;
  drop policy if exists payloads_owner_select on public.formalization_payloads;
  drop policy if exists events_owner_select on public.sync_events;
  drop policy if exists published_owner_select on public.published_records;
end $$;

create policy profiles_owner_select on public.profiles for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy trade_ideas_owner_select on public.trade_ideas for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy trade_ideas_owner_insert on public.trade_ideas for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy trade_ideas_owner_update on public.trade_ideas for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()))
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));

do $$
declare table_name text;
begin
  foreach table_name in array array['trade_candidates','catalysts','research_annotations','trade_entries','trade_checkins','trade_exits','journal_reviews'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()) and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid()))))', table_name || '_owner_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()) and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid()))))', table_name || '_owner_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()) and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid())))) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()) and (trade_idea_id is null or exists (select 1 from public.trade_ideas parent where parent.id = trade_idea_id and parent.user_id = (select auth.uid()))))', table_name || '_owner_update', table_name);
  end loop;
end $$;

create policy formalization_jobs_owner_status on public.formalization_jobs for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));
create policy published_records_owner_select on public.published_records for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id and (select private.is_approved_user()));

revoke all on all tables in schema public from anon;
revoke all on table public.profiles, public.trade_ideas, public.trade_candidates, public.catalysts,
  public.research_annotations, public.trade_entries, public.trade_checkins, public.trade_exits,
  public.journal_reviews, public.formalization_jobs, public.formalization_payloads,
  public.sync_events, public.published_records from authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update on table public.trade_ideas, public.trade_candidates, public.catalysts,
  public.research_annotations, public.trade_entries, public.trade_checkins, public.trade_exits,
  public.journal_reviews to authenticated;
grant select on table public.formalization_jobs, public.published_records to authenticated;

create or replace function public.reconcile_formalization_publication(
  p_job_id uuid,
  p_payload_revision integer,
  p_pr_number integer,
  p_pr_url text,
  p_branch text,
  p_commit_sha text,
  p_note_path text,
  p_payload_hash text,
  p_canonical_record jsonb,
  p_nonce uuid,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.formalization_jobs%rowtype;
  payload public.formalization_payloads%rowtype;
  source_table text;
  source_revision integer;
  source_owner uuid;
  published_id uuid;
  existing_commit text;
  existing_revision integer;
  published_time timestamptz := now();
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'trusted backend role required';
  end if;
  if p_occurred_at < now() - interval '5 minutes' or p_occurred_at > now() + interval '1 minute' then raise exception 'stale reconciliation callback'; end if;
  if p_pr_number < 1 or p_commit_sha !~ '^[0-9a-f]{40,64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid publication identifiers'; end if;
  if p_branch !~ '^formalize/[a-z_]+/[a-z0-9.-]+-[0-9a-f]{8}-r[1-9][0-9]*$' then raise exception 'invalid branch'; end if;
  if p_note_path like '%..%' or left(p_note_path, 1) = '/' or right(p_note_path, 3) <> '.md' then raise exception 'invalid note path'; end if;
  if octet_length(p_canonical_record::text) > 500000 then raise exception 'canonical record too large'; end if;

  insert into private.reconciliation_nonces(nonce, job_id) values (p_nonce, p_job_id);
  select * into job from public.formalization_jobs where id = p_job_id for update;
  if not found then raise exception 'formalization job not found'; end if;
  select * into payload from public.formalization_payloads where job_id = job.id and user_id = job.user_id for update;
  if not found then raise exception 'formalization payload not found'; end if;
  if job.payload_revision <> p_payload_revision or payload.payload_hash <> p_payload_hash then raise exception 'payload revision or hash mismatch'; end if;
  if job.pr_number is distinct from p_pr_number or job.branch is distinct from p_branch or job.note_path is distinct from p_note_path then raise exception 'pull request receipt mismatch'; end if;
  if p_canonical_record->>'record_id' is distinct from job.record_id::text
     or (p_canonical_record->>'source_revision')::integer is distinct from p_payload_revision
     or p_canonical_record->>'note_path' is distinct from p_note_path then raise exception 'canonical record mismatch'; end if;

  if job.status = 'published'::public.oj_sync_status then
    select commit_sha, payload_revision into existing_commit, existing_revision
    from public.published_records where record_type = job.record_type and record_id = job.record_id and user_id = job.user_id;
    if existing_commit = p_commit_sha and existing_revision = p_payload_revision then
      return jsonb_build_object('status','published','idempotent',true,'job_id',job.id,'commit_sha',existing_commit);
    end if;
    raise exception 'conflicting publication for an already-published revision';
  end if;
  if job.status not in ('pull_request_open','validated','merged','publishing') then raise exception 'job is not publishable from current state'; end if;

  source_table := case job.record_type
    when 'trade_idea' then 'trade_ideas'
    when 'trade_entry' then 'trade_entries'
    when 'trade_checkin' then 'trade_checkins'
    when 'trade_exit' then 'trade_exits'
    when 'journal_review' then 'journal_reviews'
    when 'catalyst' then 'catalysts'
    when 'research_annotation' then 'research_annotations'
    else null end;
  if source_table is null then raise exception 'unsupported record type'; end if;
  execute format('select revision, user_id from public.%I where id = $1 for update', source_table)
    into source_revision, source_owner using job.record_id;
  if source_owner is distinct from job.user_id or source_revision is distinct from p_payload_revision then raise exception 'source ownership or revision mismatch'; end if;

  insert into public.published_records(user_id, record_type, record_id, note_path, commit_sha, pr_number, merged_at, payload_revision, payload_hash, canonical, updated_at)
  values (job.user_id, job.record_type, job.record_id, p_note_path, p_commit_sha, p_pr_number, published_time, p_payload_revision, p_payload_hash, p_canonical_record, published_time)
  on conflict (record_type, record_id) do update set
    user_id = excluded.user_id, note_path = excluded.note_path, commit_sha = excluded.commit_sha,
    pr_number = excluded.pr_number, merged_at = excluded.merged_at, payload_revision = excluded.payload_revision,
    payload_hash = excluded.payload_hash, canonical = excluded.canonical, updated_at = excluded.updated_at
  where public.published_records.user_id = excluded.user_id
  returning id into published_id;
  if published_id is null then raise exception 'published owner conflict'; end if;

  execute format('update public.%I set sync_status = $1, updated_at = $2 where id = $3 and user_id = $4', source_table)
    using 'published'::public.oj_sync_status, published_time, job.record_id, job.user_id;
  if source_table = 'trade_ideas' then
    update public.trade_ideas set published_record_id = published_id, published_commit_sha = p_commit_sha,
      published_note_path = p_note_path, last_published_at = published_time
    where id = job.record_id and user_id = job.user_id;
  end if;
  update public.formalization_payloads set published_commit_sha = p_commit_sha, published_at = published_time where id = payload.id;
  update public.formalization_jobs set status = 'published', pr_number = p_pr_number, pr_url = p_pr_url,
    branch = p_branch, note_path = p_note_path, payload_hash = p_payload_hash,
    canonical_commit_sha = p_commit_sha, published_at = published_time, updated_at = published_time, error = null
  where id = job.id;
  insert into public.sync_events(user_id, record_type, record_id, event, revision, metadata)
  values (job.user_id, job.record_type, job.record_id, 'published', p_payload_revision,
    jsonb_build_object('job_id',job.id,'pr_number',p_pr_number,'commit_sha',p_commit_sha,'note_path',p_note_path));
  return jsonb_build_object('status','published','idempotent',false,'job_id',job.id,'published_record_id',published_id,'commit_sha',p_commit_sha,'published_at',published_time);
end
$$;
revoke all on function public.reconcile_formalization_publication(uuid,integer,integer,text,text,text,text,text,jsonb,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_formalization_publication(uuid,integer,integer,text,text,text,text,text,jsonb,uuid,timestamptz) to service_role;
