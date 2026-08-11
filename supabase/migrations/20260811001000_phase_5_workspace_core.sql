-- Phase 5: solo-first workspace membership layered on stable app identities.
-- Account roles remain app authorization. Workspace roles only authorize shared research.

begin;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_role text not null default 'member' check (workspace_role in ('owner', 'member')),
  membership_status text not null default 'active' check (membership_status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (workspace_id, user_id),
  constraint workspace_members_ended_consistent check (
    (membership_status = 'active' and ended_at is null)
    or (membership_status <> 'active' and ended_at is not null)
  )
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email_normalized text not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null,
  constraint workspace_invites_email_normalized check (
    email_normalized = lower(btrim(email_normalized))
    and char_length(email_normalized) between 3 and 254
    and email_normalized like '%@%'
  ),
  constraint workspace_invites_expiry_after_creation check (expires_at > created_at),
  constraint workspace_invites_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null and accepted_user_id is not null)
    or (status <> 'accepted' and accepted_at is null and accepted_user_id is null)
  )
);

create unique index workspace_invites_pending_email_idx
  on public.workspace_invites(workspace_id, email_normalized)
  where status = 'pending';
create index workspace_members_user_active_idx
  on public.workspace_members(user_id, workspace_id)
  where membership_status = 'active';
create index workspace_members_workspace_status_idx
  on public.workspace_members(workspace_id, membership_status);
create index workspace_invites_status_expiry_idx
  on public.workspace_invites(workspace_id, status, expires_at);
create index workspace_invites_invited_by_idx on public.workspace_invites(invited_by);
create index workspace_invites_accepted_user_idx on public.workspace_invites(accepted_user_id)
  where accepted_user_id is not null;
create index workspaces_created_by_idx on public.workspaces(created_by);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;

revoke all on public.workspaces, public.workspace_members, public.workspace_invites from public, anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.workspaces, public.workspace_members, public.workspace_invites to service_role;

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members member
      join public.workspaces workspace on workspace.id = member.workspace_id
      where member.workspace_id = p_workspace_id
        and member.user_id = (select auth.uid())
        and member.membership_status = 'active'
        and workspace.archived_at is null
    )
$$;

create or replace function private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members member
      join public.workspaces workspace on workspace.id = member.workspace_id
      where member.workspace_id = p_workspace_id
        and member.user_id = (select auth.uid())
        and member.workspace_role = 'owner'
        and member.membership_status = 'active'
        and workspace.archived_at is null
    )
$$;

revoke all on function private.is_workspace_member(uuid), private.is_workspace_owner(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid), private.is_workspace_owner(uuid) to authenticated, service_role;

create policy workspaces_member_select on public.workspaces for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(id)));

create policy workspace_members_member_select on public.workspace_members for select to authenticated
  using ((select private.is_approved_user()) and (select private.is_workspace_member(workspace_id)));

-- Workspace invitations stay server-managed and have no browser policy or table grant.

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  user_id uuid,
  display_name text,
  initials text,
  workspace_role text,
  membership_status text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_approved_user())
    or not (select private.is_workspace_member(p_workspace_id))
  then
    raise exception 'active workspace membership required';
  end if;

  return query
  select member.workspace_id, member.user_id, profile.display_name, profile.initials,
         member.workspace_role, member.membership_status, member.joined_at
  from public.workspace_members member
  join public.profiles profile on profile.id = member.user_id
  where member.workspace_id = p_workspace_id
  order by case member.workspace_role when 'owner' then 0 else 1 end,
           profile.display_name, member.created_at;
end
$$;

create or replace function public.list_pending_workspace_invites()
returns table (
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  invited_by_name text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
begin
  if current_user_id is null or not (select private.is_approved_user()) then
    raise exception 'approved authentication required';
  end if;

  select lower(btrim(email)) into current_email
  from auth.users where id = current_user_id and email_confirmed_at is not null;
  if current_email is null then raise exception 'verified email required'; end if;

  return query
  select invite.id, invite.workspace_id, workspace.name, inviter.display_name, invite.expires_at
  from public.workspace_invites invite
  join public.workspaces workspace on workspace.id = invite.workspace_id and workspace.archived_at is null
  join public.profiles inviter on inviter.id = invite.invited_by
  where invite.email_normalized = current_email
    and invite.status = 'pending'
    and invite.expires_at > now()
  order by invite.created_at desc;
end
$$;

create or replace function public.accept_workspace_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invite public.workspace_invites%rowtype;
begin
  if current_user_id is null or not (select private.is_approved_user()) then
    raise exception 'approved authentication required';
  end if;
  select lower(btrim(email)) into current_email
  from auth.users where id = current_user_id and email_confirmed_at is not null;
  if current_email is null then raise exception 'verified email required'; end if;

  select * into invite from public.workspace_invites
  where id = p_invite_id for update;
  if not found or invite.status <> 'pending' or invite.expires_at <= now() then
    raise exception 'valid workspace invitation required';
  end if;
  if invite.email_normalized <> current_email then raise exception 'workspace invitation belongs to another account'; end if;

  insert into public.workspace_members(workspace_id, user_id, workspace_role, membership_status, joined_at, ended_at)
  values (invite.workspace_id, current_user_id, 'member', 'active', now(), null)
  on conflict (workspace_id, user_id) do update
    set workspace_role = 'member', membership_status = 'active', joined_at = now(), ended_at = null, updated_at = now();

  update public.workspace_invites
  set status = 'accepted', accepted_at = now(), accepted_user_id = current_user_id
  where id = invite.id;
  return invite.workspace_id;
end
$$;

create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_approved_user()) or not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'workspace owner required';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then raise exception 'invalid workspace name'; end if;
  update public.workspaces set name = btrim(p_name), updated_at = now()
  where id = p_workspace_id and archived_at is null;
end
$$;

create or replace function public.leave_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid()); current_role text;
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  select workspace_role into current_role from public.workspace_members
  where workspace_id = p_workspace_id and user_id = current_user_id and membership_status = 'active' for update;
  if current_role is null then raise exception 'active workspace membership required'; end if;
  if current_role = 'owner' then raise exception 'the only workspace owner cannot leave'; end if;
  update public.workspace_members set membership_status = 'left', ended_at = now(), updated_at = now()
  where workspace_id = p_workspace_id and user_id = current_user_id;
end
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_approved_user()) or not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'workspace owner required';
  end if;
  if p_user_id = (select auth.uid()) then raise exception 'the only workspace owner cannot be removed'; end if;
  update public.workspace_members
  set membership_status = 'removed', ended_at = now(), updated_at = now()
  where workspace_id = p_workspace_id and user_id = p_user_id
    and membership_status = 'active' and workspace_role = 'member';
  if not found then raise exception 'active workspace member not found'; end if;
end
$$;

revoke all on function public.list_workspace_members(uuid), public.list_pending_workspace_invites(),
  public.accept_workspace_invite(uuid), public.rename_workspace(uuid, text),
  public.leave_workspace(uuid), public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid), public.list_pending_workspace_invites(),
  public.accept_workspace_invite(uuid), public.rename_workspace(uuid, text),
  public.leave_workspace(uuid), public.remove_workspace_member(uuid, uuid) to authenticated;

-- Existing approved app owners receive a default workspace without a setup gate.
insert into public.workspaces(name, created_by)
select 'OJ Workspace', profile.id
from public.profiles profile
where profile.approved is true and profile.account_status = 'active' and profile.account_role = 'owner'
  and not exists (
    select 1 from public.workspace_members member
    where member.user_id = profile.id and member.membership_status = 'active'
  );

insert into public.workspace_members(workspace_id, user_id, workspace_role, membership_status)
select workspace.id, workspace.created_by, 'owner', 'active'
from public.workspaces workspace
where not exists (
  select 1 from public.workspace_members member
  where member.workspace_id = workspace.id and member.user_id = workspace.created_by
);

-- Account activation also resolves every matching pending workspace invitation.
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
  workspace_invite record;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select lower(btrim(email)) into current_email
  from auth.users
  where id = current_user_id and email_confirmed_at is not null and encrypted_password is not null;
  if current_email is null then raise exception 'verified password identity required'; end if;

  select id into matching_invite_id
  from public.account_invites
  where email_normalized = current_email and status = 'pending' and expires_at > now()
  order by created_at desc limit 1 for update;
  if matching_invite_id is null then raise exception 'valid invitation required'; end if;

  update public.profiles set approved = true, account_status = 'active'
  where id = current_user_id and lower(btrim(email)) = current_email
    and account_role = 'member' and account_status = 'invited';
  if not found then raise exception 'invited profile required'; end if;

  update public.account_invites
  set status = 'accepted', accepted_at = now(), accepted_user_id = current_user_id
  where id = matching_invite_id;

  for workspace_invite in
    select * from public.workspace_invites
    where email_normalized = current_email and status = 'pending' and expires_at > now()
    order by created_at for update
  loop
    insert into public.workspace_members(workspace_id, user_id, workspace_role, membership_status, joined_at, ended_at)
    values (workspace_invite.workspace_id, current_user_id, 'member', 'active', now(), null)
    on conflict (workspace_id, user_id) do update
      set workspace_role = 'member', membership_status = 'active', joined_at = now(), ended_at = null, updated_at = now();
    update public.workspace_invites
    set status = 'accepted', accepted_at = now(), accepted_user_id = current_user_id
    where id = workspace_invite.id;
  end loop;
end
$$;

revoke all on function public.activate_invited_account() from public, anon;
grant execute on function public.activate_invited_account() to authenticated;

comment on table public.workspaces is 'Solo-first shared research workspaces; never a container for brokerage, account, or trade ownership.';
comment on table public.workspace_members is 'Workspace authorization is separate from profiles.account_role.';
comment on table public.workspace_invites is 'Server-managed workspace invitations with no browser table access.';

commit;
