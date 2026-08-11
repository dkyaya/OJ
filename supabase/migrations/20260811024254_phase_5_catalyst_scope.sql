-- Phase 5: share scheduled catalyst facts while keeping personal conclusions private.

begin;

alter table public.catalysts
  add column workspace_id uuid references public.workspaces(id) on delete restrict,
  add column created_by uuid references public.profiles(id) on delete restrict,
  add column updated_by uuid references public.profiles(id) on delete restrict,
  add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));

alter table public.catalyst_security_mappings
  add column workspace_id uuid references public.workspaces(id) on delete restrict,
  add column created_by uuid references public.profiles(id) on delete restrict,
  add column updated_by uuid references public.profiles(id) on delete restrict,
  add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));

alter table public.research_annotations
  add column workspace_id uuid references public.workspaces(id) on delete set null,
  add column created_by uuid references public.profiles(id) on delete restrict,
  add column updated_by uuid references public.profiles(id) on delete restrict,
  add column visibility text not null default 'private' check (visibility = 'private');

update public.catalysts catalyst
set workspace_id = member.workspace_id,
    created_by = catalyst.user_id,
    updated_by = catalyst.user_id,
    visibility = case when catalyst.trade_idea_id is null then 'workspace' else 'private' end
from public.workspace_members member
where member.user_id = catalyst.user_id
  and member.membership_status = 'active'
  and member.workspace_role = 'owner';

update public.catalysts
set created_by = user_id, updated_by = user_id
where created_by is null or updated_by is null;

update public.catalyst_security_mappings mapping
set workspace_id = catalyst.workspace_id,
    created_by = mapping.user_id,
    updated_by = mapping.user_id,
    visibility = case
      when catalyst.visibility = 'workspace' and mapping.trade_idea_id is null then 'workspace'
      else 'private'
    end
from public.catalysts catalyst
where catalyst.id = mapping.catalyst_id and catalyst.user_id = mapping.user_id;

update public.catalyst_security_mappings
set created_by = user_id, updated_by = user_id
where created_by is null or updated_by is null;

update public.research_annotations annotation
set workspace_id = member.workspace_id, created_by = annotation.user_id, updated_by = annotation.user_id, visibility = 'private'
from public.workspace_members member
where member.user_id = annotation.user_id and member.membership_status = 'active';

update public.research_annotations
set created_by = user_id, updated_by = user_id, visibility = 'private'
where created_by is null or updated_by is null;

alter table public.catalysts alter column created_by set not null, alter column updated_by set not null;
alter table public.catalyst_security_mappings alter column created_by set not null, alter column updated_by set not null;
alter table public.research_annotations alter column created_by set not null, alter column updated_by set not null;

alter table public.catalyst_security_mappings
  add constraint catalyst_mapping_shared_has_no_private_idea check (visibility = 'private' or trade_idea_id is null);

create index catalysts_workspace_event_idx on public.catalysts(workspace_id, event_at)
  where visibility = 'workspace' and deleted_at is null;
create index catalysts_created_by_idx on public.catalysts(created_by);
create index catalysts_updated_by_idx on public.catalysts(updated_by);
create index catalyst_mappings_workspace_catalyst_idx on public.catalyst_security_mappings(workspace_id, catalyst_id)
  where visibility = 'workspace' and deleted_at is null;
create index catalyst_mappings_created_by_idx on public.catalyst_security_mappings(created_by);
create index catalyst_mappings_updated_by_idx on public.catalyst_security_mappings(updated_by);
create index research_annotations_workspace_idx on public.research_annotations(workspace_id)
  where workspace_id is not null;
create index research_annotations_created_by_idx on public.research_annotations(created_by);
create index research_annotations_updated_by_idx on public.research_annotations(updated_by);

create or replace function private.guard_catalyst_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_approved_user()) then
    raise exception 'approved authentication required';
  end if;
  if tg_op = 'INSERT' then
    if new.user_id <> (select auth.uid()) or new.created_by <> (select auth.uid()) or new.updated_by <> (select auth.uid()) then
      raise exception 'catalyst authorship must match the current user';
    end if;
  else
    if new.user_id is distinct from old.user_id
      or new.created_by is distinct from old.created_by
      or new.workspace_id is distinct from old.workspace_id
    then
      raise exception 'catalyst ownership and workspace scope are immutable';
    end if;
    if new.updated_by <> (select auth.uid()) then raise exception 'catalyst updater must match the current user'; end if;
  end if;
  if new.visibility = 'workspace' then
    if new.workspace_id is null or not (select private.is_workspace_member(new.workspace_id)) then
      raise exception 'active workspace membership required';
    end if;
  elsif new.user_id <> (select auth.uid()) then
    raise exception 'private catalysts belong to their creator';
  end if;
  return new;
end
$$;

revoke all on function private.guard_catalyst_scope() from public, anon, authenticated;
drop trigger if exists catalysts_scope_guard on public.catalysts;
create trigger catalysts_scope_guard before insert or update on public.catalysts
  for each row execute function private.guard_catalyst_scope();

drop policy if exists catalysts_owner_select on public.catalysts;
drop policy if exists catalysts_owner_insert on public.catalysts;
drop policy if exists catalysts_owner_update on public.catalysts;

create policy catalysts_scoped_select on public.catalysts for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      (visibility = 'private' and user_id = (select auth.uid()))
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  );
create policy catalysts_scoped_insert on public.catalysts for insert to authenticated
  with check (
    (select private.is_approved_user())
    and user_id = (select auth.uid())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and (
      (visibility = 'private' and workspace_id is null or visibility = 'private' and (select private.is_workspace_member(workspace_id)))
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
    and (trade_idea_id is null or exists (
      select 1 from public.trade_ideas idea
      where idea.id = trade_idea_id and idea.user_id = (select auth.uid())
    ))
  );
create policy catalysts_scoped_update on public.catalysts for update to authenticated
  using (
    (select private.is_approved_user())
    and (
      (visibility = 'private' and user_id = (select auth.uid()))
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  )
  with check (
    (select private.is_approved_user())
    and updated_by = (select auth.uid())
    and (
      (visibility = 'private' and user_id = (select auth.uid()))
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
    and (trade_idea_id is null or exists (
      select 1 from public.trade_ideas idea
      where idea.id = trade_idea_id and idea.user_id = user_id
    ))
  );

-- Shared mappings are written through a server-checked RPC because the legacy
-- user_id must continue matching the catalyst owner for its composite foreign key.
drop policy if exists catalyst_security_mappings_owner_insert on public.catalyst_security_mappings;
drop policy if exists catalyst_security_mappings_owner_update on public.catalyst_security_mappings;
drop policy if exists catalyst_security_mappings_owner_select on public.catalyst_security_mappings;
revoke insert, update on public.catalyst_security_mappings from authenticated;

create policy catalyst_mappings_scoped_select on public.catalyst_security_mappings for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      (visibility = 'private' and user_id = (select auth.uid()))
      or (visibility = 'workspace' and (select private.is_workspace_member(workspace_id)))
    )
  );

create or replace function public.save_catalyst_mapping(
  p_catalyst_id uuid,
  p_mapping_id uuid,
  p_ticker text,
  p_exposure_type text,
  p_sensitivity text,
  p_rationale text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  catalyst public.catalysts%rowtype;
  mapping public.catalyst_security_mappings%rowtype;
  resolved_id uuid := coalesce(p_mapping_id, gen_random_uuid());
begin
  if current_user_id is null or not (select private.is_approved_user()) then raise exception 'approved authentication required'; end if;
  if p_ticker is null or upper(btrim(p_ticker)) !~ '^[A-Z0-9._-]{1,20}$' then raise exception 'valid ticker required'; end if;
  if p_exposure_type not in ('direct','indirect','index','sector','rates','supply-chain','peer') then raise exception 'valid exposure type required'; end if;

  select * into catalyst from public.catalysts where id = p_catalyst_id and deleted_at is null;
  if not found then raise exception 'catalyst not found'; end if;
  if catalyst.visibility = 'workspace' then
    if catalyst.workspace_id is null or not (select private.is_workspace_member(catalyst.workspace_id)) then raise exception 'active workspace membership required'; end if;
  elsif catalyst.user_id <> current_user_id then raise exception 'private catalyst access denied'; end if;

  if p_mapping_id is null then
    insert into public.catalyst_security_mappings(
      id, user_id, catalyst_id, ticker, exposure_type, sensitivity, rationale,
      workspace_id, created_by, updated_by, visibility, research_status, revision, sync_status
    ) values (
      resolved_id, catalyst.user_id, catalyst.id, upper(btrim(p_ticker)), p_exposure_type,
      nullif(btrim(p_sensitivity), ''), nullif(btrim(p_rationale), ''), catalyst.workspace_id,
      current_user_id, current_user_id, catalyst.visibility, 'researching', 1, 'cloud_draft'
    );
  else
    select * into mapping from public.catalyst_security_mappings where id = p_mapping_id for update;
    if not found or mapping.catalyst_id <> catalyst.id then raise exception 'mapping not found'; end if;
    if mapping.visibility = 'private' and mapping.created_by <> current_user_id then raise exception 'private mapping access denied'; end if;
    update public.catalyst_security_mappings
    set ticker = upper(btrim(p_ticker)), exposure_type = p_exposure_type,
        sensitivity = nullif(btrim(p_sensitivity), ''), rationale = nullif(btrim(p_rationale), ''),
        updated_by = current_user_id, revision = revision + 1, updated_at = now()
    where id = mapping.id;
  end if;
  return resolved_id;
end
$$;

revoke all on function public.save_catalyst_mapping(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.save_catalyst_mapping(uuid, uuid, text, text, text, text) to authenticated;

comment on column public.catalysts.visibility is 'Workspace shares scheduled facts only; private conclusions remain separate records.';
comment on column public.research_annotations.visibility is 'Legacy annotations remain private by design.';

commit;
