begin;

alter table public.profiles
  add column display_name text,
  add column initials text,
  add column account_role text not null default 'member',
  add column account_status text not null default 'pending';

alter table public.profiles
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 80),
  add constraint profiles_initials_format check (initials is null or initials ~ '^[A-Z0-9]{1,4}$'),
  add constraint profiles_account_role_check check (account_role in ('owner', 'member')),
  add constraint profiles_account_status_check check (account_status in ('pending', 'invited', 'active', 'disabled'));

update public.profiles
set
  display_name = coalesce(nullif(display_name, ''), split_part(email, '@', 1), 'OJ Member'),
  initials = coalesce(
    nullif(initials, ''),
    nullif(upper(left(regexp_replace(coalesce(split_part(email, '@', 1), 'OJ'), '[^A-Za-z0-9]', '', 'g'), 4)), ''),
    'OJ'
  ),
  account_status = case when approved then 'active' else account_status end;

update public.profiles
set account_role = 'owner', account_status = 'active'
where id = (
  select id from public.profiles
  where approved is true
  order by created_at asc, id asc
  limit 1
);

alter table public.profiles
  alter column display_name set not null,
  alter column initials set not null;

create table public.account_invites (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null,
  constraint account_invites_email_normalized check (
    email_normalized = lower(btrim(email_normalized))
    and char_length(email_normalized) between 3 and 254
    and email_normalized like '%@%'
  ),
  constraint account_invites_expiry_after_creation check (expires_at > created_at),
  constraint account_invites_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null and accepted_user_id is not null)
    or (status <> 'accepted' and accepted_at is null and accepted_user_id is null)
  )
);

create index account_invites_status_expiry_idx on public.account_invites(status, expires_at);
create index trade_entry_requests_user_id_idx on public.trade_entry_requests(user_id);
create index trade_entry_requests_trade_idea_id_idx on public.trade_entry_requests(trade_idea_id);

alter table public.account_invites enable row level security;
alter table public.account_invites force row level security;
revoke all on table public.account_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.account_invites to service_role;

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
      where id = (select auth.uid())
        and approved is true
        and account_status = 'active'
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
declare
  invited boolean;
  generated_name text;
  generated_initials text;
begin
  select exists (
    select 1 from public.account_invites
    where email_normalized = lower(btrim(new.email))
      and status = 'pending'
      and expires_at > now()
  ) into invited;

  generated_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'OJ Member');
  generated_initials := upper(left(regexp_replace(generated_name, '[^A-Za-z0-9]', '', 'g'), 4));
  if generated_initials = '' then generated_initials := 'OJ'; end if;

  insert into public.profiles(id, email, approved, display_name, initials, account_role, account_status)
  values (new.id, new.email, false, generated_name, generated_initials, 'member', case when invited then 'invited' else 'pending' end)
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

create or replace function private.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.approved is distinct from old.approved
      or new.account_role is distinct from old.account_role
      or new.account_status is distinct from old.account_status
    ) then
    raise exception 'profile privilege fields are server-managed';
  end if;
  return new;
end
$$;
revoke all on function private.guard_profile_privileges() from public, anon, authenticated;

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id and (select private.is_approved_user()))
with check ((select auth.uid()) is not null and (select auth.uid()) = id and (select private.is_approved_user()));

revoke update on table public.profiles from authenticated;
grant update(display_name, initials) on table public.profiles to authenticated;

create or replace function public.activate_invited_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  matching_invite_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select lower(btrim(email))
  into current_email
  from auth.users
  where id = current_user_id
    and email_confirmed_at is not null
    and encrypted_password is not null;

  if current_email is null then
    raise exception 'verified password identity required';
  end if;

  select id into matching_invite_id
  from public.account_invites
  where email_normalized = current_email
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if matching_invite_id is null then
    raise exception 'valid invitation required';
  end if;

  update public.profiles
  set approved = true, account_status = 'active'
  where id = current_user_id
    and lower(btrim(email)) = current_email
    and account_role = 'member'
    and account_status = 'invited';

  if not found then
    raise exception 'invited profile required';
  end if;

  update public.account_invites
  set status = 'accepted', accepted_at = now(), accepted_user_id = current_user_id
  where id = matching_invite_id;
end
$$;
revoke all on function public.activate_invited_account() from public, anon;
grant execute on function public.activate_invited_account() to authenticated;

comment on table public.account_invites is 'Private server-managed account invitations. No browser read policy exists.';
comment on function public.activate_invited_account() is 'Activates only a verified password identity with a matching unexpired server-issued invitation.';
comment on column public.profiles.account_role is 'Minimal app-level Phase 4.5 role; separate from future workspace membership roles.';

commit;
