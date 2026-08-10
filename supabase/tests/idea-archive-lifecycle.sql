-- Run through a trusted SQL session after all migrations. Every write rolls back.
begin;

insert into auth.users(id,email) values
  ('31111111-1111-4111-8111-111111111111','archive-owner@example.invalid'),
  ('32222222-2222-4222-8222-222222222222','archive-other@example.invalid');
update public.profiles set approved=true, account_status='active'
where id in ('31111111-1111-4111-8111-111111111111','32222222-2222-4222-8222-222222222222');

insert into public.account_policies(user_id,total_account_capital,maximum_open_options_risk,preferred_defined_risk_strategies,effective_date)
values ('31111111-1111-4111-8111-111111111111',5000,500,array['bear-put-spread'],'2026-08-10');

insert into public.trade_ideas(id,user_id,ticker,strategy,bias,data) values
  ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','31111111-1111-4111-8111-111111111111','ARCHIVE','bear-put-spread','bearish','{"Status":"Ready","Thesis":"Preserve me"}'),
  ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','32222222-2222-4222-8222-222222222222','OTHER','bear-put-spread','bearish','{"Status":"Ready"}'),
  ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','31111111-1111-4111-8111-111111111111','ACTIVE','bear-put-spread','bearish','{"Status":"Ready"}'),
  ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','31111111-1111-4111-8111-111111111111','CLOSED','bear-put-spread','bearish','{"Status":"Ready"}');
insert into public.trade_ideas(id,user_id,ticker,strategy,bias,data,deleted_at) values
  ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','31111111-1111-4111-8111-111111111111','HISTORY','bear-put-spread','bearish','{"Status":"Ready"}',now());

insert into public.trade_candidates(id,trade_idea_id,user_id,name,data)
values ('3ccccccc-cccc-4ccc-8ccc-ccccccccccc1','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','31111111-1111-4111-8111-111111111111','Balanced','{"long_strike":100,"short_strike":97}');

insert into public.catalysts(id,trade_idea_id,user_id,event,event_type,data)
values ('3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','31111111-1111-4111-8111-111111111111','Shared test catalyst','Other','{}');
insert into public.catalyst_security_mappings(id,user_id,catalyst_id,trade_idea_id,ticker,exposure_type)
values ('3fffffff-ffff-4fff-8fff-fffffffffff1','31111111-1111-4111-8111-111111111111','3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ARCHIVE','direct');
insert into public.research_annotations(id,trade_idea_id,user_id,classification,summary)
values ('30000000-0000-4000-8000-000000000001','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','31111111-1111-4111-8111-111111111111','thesis','Delete with parent');

insert into public.trades(id,user_id,trade_idea_id,ticker,strategy,status,contracts,max_risk,opened_at,closed_at,confirmed_actual) values
  ('3ddddddd-dddd-4ddd-8ddd-ddddddddddd3','31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','ACTIVE','bear-put-spread','active',1,100,now(),null,true),
  ('3ddddddd-dddd-4ddd-8ddd-ddddddddddd4','31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','CLOSED','bear-put-spread','closed',1,100,now() - interval '2 days',now() - interval '1 day',true),
  ('3ddddddd-dddd-4ddd-8ddd-ddddddddddd5','31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','HISTORY','bear-put-spread','closed',1,100,now() - interval '2 days',now() - interval '1 day',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','31111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $test$
declare
  c integer;
  next_revision integer;
  idea_status text;
begin
  begin
    update public.trade_ideas
    set deleted_at=now(), revision=revision+1
    where id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'direct browser archive unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'archive state is server-managed' then raise; end if;
  end;

  next_revision := public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,true);
  if next_revision <> 2 then raise exception 'archive did not return revision 2'; end if;
  select count(*), max(data->>'Status') into c, idea_status
  from public.trade_ideas where id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and deleted_at is not null;
  if c <> 1 or idea_status <> 'Ready' then raise exception 'archive changed or lost the idea status'; end if;
  select count(*) into c from public.trade_candidates where trade_idea_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 1 then raise exception 'archive lost candidate records'; end if;
  select count(*) into c from public.record_revisions
  where record_type='trade_ideas' and record_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and revision=2;
  if c <> 1 then raise exception 'archive revision snapshot missing'; end if;

  begin
    perform public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,false);
    raise exception 'stale restore unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'trade idea changed on another device' then raise; end if;
  end;

  next_revision := public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',2,false);
  if next_revision <> 3 then raise exception 'restore did not return revision 3'; end if;
  select count(*) into c from public.trade_ideas
  where id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    and deleted_at is null
    and data->>'Status'='Ready'
    and entry_status='not-entered'
    and not user_confirmed_fill;
  if c <> 1 then raise exception 'restore changed canonical idea state'; end if;

  begin
    perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',3,'DELETE ARCHIVE');
    raise exception 'unarchived idea deletion unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'archive the idea before deleting it' then raise; end if;
  end;

  begin
    perform public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',1,true);
    raise exception 'cross-owner archive unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'trade idea not found' then raise; end if;
  end;
  begin
    perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',1,'DELETE OTHER');
    raise exception 'cross-owner permanent deletion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',1,true);
    raise exception 'active-trade idea archive unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'trade-backed ideas cannot be archived' then raise; end if;
  end;
  begin
    perform public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',1,true);
    raise exception 'closed-trade idea archive unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'trade-backed ideas cannot be archived' then raise; end if;
  end;
  begin
    perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',1,'DELETE HISTORY');
    raise exception 'trade-history idea deletion unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'ideas with trade or journal history cannot be deleted' then raise; end if;
  end;

  next_revision := public.set_trade_idea_archived('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',3,true);
  if next_revision <> 4 then raise exception 'second archive did not return revision 4'; end if;
  begin
    perform public.record_trade_entry('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,now(),100,'{}'::jsonb,true);
    raise exception 'archived idea unexpectedly became a trade';
  exception when raise_exception then
    if sqlerrm <> 'archived ideas cannot be entered' then raise; end if;
  end;
  begin
    delete from public.trade_ideas where id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'browser hard delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  select count(*) into c from public.trade_candidates where trade_idea_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 1 then raise exception 'archive/restore cycle lost candidate records'; end if;

  begin
    perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',3,'DELETE ARCHIVE');
    raise exception 'stale permanent delete unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'trade idea changed on another device' then raise; end if;
  end;
  begin
    perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',4,'delete archive');
    raise exception 'mismatched permanent delete unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'delete confirmation did not match' then raise; end if;
  end;

  perform public.delete_trade_idea('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',4,'DELETE ARCHIVE');
  select count(*) into c from public.trade_ideas where id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 0 then raise exception 'permanent delete retained the idea'; end if;
  select count(*) into c from public.trade_candidates where trade_idea_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 0 then raise exception 'permanent delete retained candidate rows'; end if;
  select count(*) into c from public.research_annotations where trade_idea_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 0 then raise exception 'permanent delete retained research annotations'; end if;
  select count(*) into c from public.catalyst_security_mappings where trade_idea_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 0 then raise exception 'permanent delete retained catalyst mappings'; end if;
  select count(*) into c from public.catalysts
  where id='3eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1' and trade_idea_id is null and revision=2;
  if c <> 1 then raise exception 'permanent delete did not preserve and detach the catalyst'; end if;
  select count(*) into c from public.record_revisions
  where record_type='trade_ideas' and record_id='3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if c <> 0 then raise exception 'permanent delete retained idea revisions'; end if;
  begin
    insert into public.trade_ideas(id,user_id,ticker,strategy,bias,data)
    values ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','31111111-1111-4111-8111-111111111111','ARCHIVE','bear-put-spread','bearish','{}');
    raise exception 'stale device recreated a permanently deleted idea';
  exception when raise_exception then
    if sqlerrm <> 'permanently deleted trade idea cannot be recreated' then raise; end if;
  end;
end
$test$;

select 'passed' as idea_archive_restore_delete_lifecycle;
rollback;
