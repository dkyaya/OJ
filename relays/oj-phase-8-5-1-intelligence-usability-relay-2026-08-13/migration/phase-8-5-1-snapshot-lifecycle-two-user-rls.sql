begin;

insert into auth.users(id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('51000000-0000-0000-0000-000000000001', 'snapshot-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('51000000-0000-0000-0000-000000000002', 'snapshot-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles
set approved = true, account_status = 'active'
where id in ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002');

insert into public.catalysts(id, user_id, event, event_type, created_by, updated_by, visibility, data)
values
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'User A lifecycle fixture', 'Other', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'private', '{}'),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'User B lifecycle fixture', 'Other', '51000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'private', '{}');

insert into public.research_snapshots(id, user_id, catalyst_id, snapshot_type, observed_at, methodology, values)
values
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'market_pricing', now(), 'User A immutable fixture.', '{"implied_volatility": 0.2}'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000002', 'market_pricing', now(), 'User B immutable fixture.', '{"implied_volatility": 0.3}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.remove_research_snapshot('52000000-0000-0000-0000-000000000001', 'test_snapshot', 'Lifecycle RLS fixture.');
select public.remove_research_snapshot('52000000-0000-0000-0000-000000000001', 'duplicate');

do $$
begin
  if (select count(*) from public.research_snapshot_lifecycle_events) <> 1 then
    raise exception 'owner should see the removal event';
  end if;
  if (select methodology from public.research_snapshots where id = '52000000-0000-0000-0000-000000000001') <> 'User A immutable fixture.' then
    raise exception 'removal mutated the original snapshot';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000002', true);

do $$
begin
  if (select count(*) from public.research_snapshot_lifecycle_events) <> 0 then
    raise exception 'a second user can read another owner lifecycle event';
  end if;
  begin
    perform public.restore_research_snapshot('52000000-0000-0000-0000-000000000001');
    raise exception 'a second user restored another owner snapshot';
  exception when others then
    if sqlerrm not like '%snapshot_not_found%' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select public.restore_research_snapshot('52000000-0000-0000-0000-000000000001');
select public.restore_research_snapshot('52000000-0000-0000-0000-000000000001');

do $$
begin
  if (select count(*) from public.research_snapshot_lifecycle_events) <> 2 then
    raise exception 'owner restore event was not appended';
  end if;
  if (select action from public.research_snapshot_lifecycle_events order by event_order desc limit 1) <> 'restore' then
    raise exception 'latest lifecycle state should be restored';
  end if;
end;
$$;

reset role;
rollback;
