-- Run through a trusted SQL session. Every write is rolled back.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','owner-one@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','owner-two@example.invalid');
update public.profiles set approved=true, account_status='active' where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
update public.profiles set account_role='owner' where id='11111111-1111-4111-8111-111111111111';
insert into public.account_policies(user_id,total_account_capital,maximum_open_options_risk,preferred_defined_risk_strategies,effective_date)
values
 ('11111111-1111-4111-8111-111111111111',5000,500,array['bear-put-spread'],'2026-08-08'),
 ('22222222-2222-4222-8222-222222222222',5000,500,array['bull-call-spread'],'2026-08-08');
insert into public.trade_ideas(id,user_id,ticker,strategy,bias,data)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','DEMO','bear-put-spread','bearish','{"Status":"Ready"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','22222222-2222-4222-8222-222222222222','SAMPLE','bull-call-spread','bullish','{"Status":"Ready"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','11111111-1111-4111-8111-111111111111','DRAFT','bear-put-spread','bearish','{"Status":"Draft"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','11111111-1111-4111-8111-111111111111','READY2','bear-put-spread','bearish','{"Status":"Ready"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.trade_ideas;
  if c <> 3 then raise exception 'owner one could see % idea rows', c; end if;
  update public.profiles set display_name='Owner One', initials='OO' where id='11111111-1111-4111-8111-111111111111';
  update public.profiles set display_name='Owner Two' where id='22222222-2222-4222-8222-222222222222';
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'cross-owner profile update unexpectedly changed a row'; end if;
  begin
    update public.profiles set account_role='owner' where id='11111111-1111-4111-8111-111111111111';
    raise exception 'browser role update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.account_invites;
    raise exception 'browser invitation enumeration unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  insert into public.application_preferences(user_id,theme) values ('11111111-1111-4111-8111-111111111111','dark');
  begin
    insert into public.application_preferences(user_id,theme) values ('22222222-2222-4222-8222-222222222222','light');
    raise exception 'cross-owner preference insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.trades(user_id,trade_idea_id,ticker,strategy,status,contracts,max_risk,opened_at,confirmed_actual)
    values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','DEMO','bear-put-spread','active',1,100,now(),true);
    raise exception 'direct confirmed-trade insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_trade_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,now(),100,'{}'::jsonb,false);
    raise exception 'unconfirmed entry unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'explicit entry confirmation required' then raise; end if;
  end;
  begin
    perform public.record_trade_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',1,now(),100,'{}'::jsonb,true);
    raise exception 'draft research unexpectedly became a trade';
  exception when raise_exception then
    if sqlerrm <> 'trade idea must be watchlist or ready' then raise; end if;
  end;
  perform public.record_trade_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,now(),100,'{}'::jsonb,true);
  select count(*) into c from public.trades;
  if c <> 1 then raise exception 'confirmed entry did not create exactly one owner trade'; end if;
  begin
    perform public.record_trade_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',1,now(),450,'{}'::jsonb,true);
    raise exception 'over-capacity entry unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'entry exceeds maximum open options risk' then raise; end if;
  end;
end
$test$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.trades;
  if c <> 0 then raise exception 'owner two could see owner one trade'; end if;
  begin
    update public.profiles set approved=true where id='22222222-2222-4222-8222-222222222222';
    raise exception 'member approval update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_trade_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,now(),100,'{}'::jsonb,true);
    raise exception 'cross-owner RPC unexpectedly succeeded';
  exception when insufficient_privilege then null;
  when raise_exception then
    if sqlerrm <> 'trade idea not found' then raise; end if;
  end;
end
$test$;
select 'passed' as canonical_two_user_rls_and_lifecycle;
rollback;
