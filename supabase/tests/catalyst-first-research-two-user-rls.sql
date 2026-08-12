-- Synthetic owner isolation for sources, snapshots, and multi-catalyst links.
begin;

insert into auth.users(id,email,email_confirmed_at,encrypted_password) values
  ('61111111-1111-4111-8111-111111111111','catalyst-owner-a@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('62222222-2222-4222-8222-222222222222','catalyst-owner-b@example.invalid',now(),encode(gen_random_bytes(32),'hex'));
update public.profiles set approved = true, account_status = 'active' where id in (
  '61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222'
);

insert into public.trade_ideas(id,user_id,ticker,strategy,bias,research_stage,data) values
  ('61aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','61111111-1111-4111-8111-111111111111','SYNTHA','bear-put-spread','bearish','researching','{}'),
  ('62bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','62222222-2222-4222-8222-222222222222','SYNTHB','bull-call-spread','bullish','watching','{}');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
insert into public.catalysts(id,user_id,event,event_type,event_at,created_by,updated_by,visibility,data)
values ('61cccccc-cccc-4ccc-8ccc-ccccccccccc1','61111111-1111-4111-8111-111111111111','Synthetic catalyst A','Other',now() + interval '7 days','61111111-1111-4111-8111-111111111111','61111111-1111-4111-8111-111111111111','private','{}');
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
insert into public.catalysts(id,user_id,event,event_type,event_at,created_by,updated_by,visibility,data)
values ('62dddddd-dddd-4ddd-8ddd-ddddddddddd2','62222222-2222-4222-8222-222222222222','Synthetic catalyst B','Other',now() + interval '8 days','62222222-2222-4222-8222-222222222222','62222222-2222-4222-8222-222222222222','private','{}');
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);

insert into public.trade_idea_catalysts(user_id,trade_idea_id,catalyst_id,relationship)
values ('61111111-1111-4111-8111-111111111111','61aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','61cccccc-cccc-4ccc-8ccc-ccccccccccc1','primary');
insert into public.research_sources(id,user_id,catalyst_id,trade_idea_id,title,url,source_quality)
values ('61eeeeee-eeee-4eee-8eee-eeeeeeeeeee1','61111111-1111-4111-8111-111111111111','61cccccc-cccc-4ccc-8ccc-ccccccccccc1','61aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Synthetic source A','https://example.invalid/a','official');
insert into public.research_snapshots(user_id,catalyst_id,trade_idea_id,source_id,snapshot_type,ticker,observed_at,methodology,values)
values ('61111111-1111-4111-8111-111111111111','61cccccc-cccc-4ccc-8ccc-ccccccccccc1','61aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','61eeeeee-eeee-4eee-8eee-eeeeeeeeeee1','event_implied_move','SYNTHA',now(),'Synthetic ATM straddle midpoint divided by synthetic spot.','{"event_implied_move_percent":"1.2"}');

select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.trade_idea_catalysts; if c <> 0 then raise exception 'user B saw user A Idea links'; end if;
  select count(*) into c from public.research_sources; if c <> 0 then raise exception 'user B saw user A sources'; end if;
  select count(*) into c from public.research_snapshots; if c <> 0 then raise exception 'user B saw user A snapshots'; end if;
  begin
    insert into public.research_snapshots(user_id,catalyst_id,snapshot_type,observed_at,methodology)
    values ('62222222-2222-4222-8222-222222222222','61cccccc-cccc-4ccc-8ccc-ccccccccccc1','market_pricing',now(),'Cross-owner target attempt.');
    raise exception 'user B attached a snapshot to user A private catalyst';
  exception when insufficient_privilege then null; end;
end
$test$;

select 'passed' as catalyst_first_research_two_user_rls;
rollback;
