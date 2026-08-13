-- Rolled-back synthetic three-user lifecycle and shared-Catalyst privacy test.
begin;

insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('61000000-0000-0000-0000-000000000001','trade-a@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('61000000-0000-0000-0000-000000000002','trade-b@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('61000000-0000-0000-0000-000000000003','trade-c@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

update public.profiles set approved=true,account_status='active'
where id in (
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000002',
  '61000000-0000-0000-0000-000000000003'
);

insert into public.account_policies(user_id,total_account_capital,maximum_open_options_risk,preferred_defined_risk_strategies,effective_date,policy_version)
values
  ('61000000-0000-0000-0000-000000000001',5000,800,array['bull-call-spread'],'2026-08-13',1),
  ('61000000-0000-0000-0000-000000000002',5000,800,array['bull-call-spread'],'2026-08-13',1),
  ('61000000-0000-0000-0000-000000000003',5000,800,array['bull-call-spread'],'2026-08-13',1);

insert into public.workspaces(id,name,created_by)
values ('64000000-0000-0000-0000-000000000001','Synthetic Shared Facts','61000000-0000-0000-0000-000000000001');
insert into public.workspace_members(workspace_id,user_id,workspace_role,membership_status)
values
  ('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','owner','active'),
  ('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002','member','active');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);

insert into public.catalysts(
  id,user_id,event,event_type,event_at,data,workspace_id,created_by,updated_by,visibility
) values (
  '65000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001',
  'Synthetic workspace catalyst','Other','2026-12-01T13:30:00Z','{}',
  '64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001','workspace'
);

-- Seed an otherwise valid User C Idea through the trusted test session so the
-- entry RPC itself is also proven to reject inaccessible shared provenance.
reset role;
insert into public.trade_ideas(
  id,user_id,ticker,strategy,bias,idea_status,research_stage,entry_status,user_confirmed_fill,
  originating_catalyst_id,data,revision
) values (
  '62000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000003',
  'BLOCKED','bull-call-spread','Bullish','ready','entry_candidate','not-entered',false,
  '65000000-0000-0000-0000-000000000001','{"Thesis":"Synthetic inaccessible provenance."}',1
);
set local role authenticated;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);

insert into public.trade_ideas(
  id,user_id,ticker,strategy,bias,idea_status,research_stage,entry_status,user_confirmed_fill,
  originating_catalyst_id,data,revision
) values (
  '62000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002',
  'SYNTH','bull-call-spread','Bullish','ready','entry_candidate','not-entered',false,
  '65000000-0000-0000-0000-000000000001',
  '{"Thesis":"Original synthetic thesis.","Evidence":"Synthetic evidence.","Invalidation":"Synthetic invalidation.","Planned exit":"Synthetic planned exit."}',1
);
insert into public.trade_candidates(id,trade_idea_id,user_id,name,data,revision)
values (
  '63000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002',
  '61000000-0000-0000-0000-000000000002','Candidate',
  '{"expiration":"2026-12-18","long_strike":100,"short_strike":105,"debit":2.1,"contracts":1,"max_loss":210,"max_profit":290,"break_even":102.1}',1
);

select public.record_trade_entry_v2(
  '62000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002',
  'pre_catalyst_anticipation','2026-12-18',100,105,1,'2026-08-13T14:00:00Z',
  1.98,0.50,'Synthetic execution.',true,false,null
);

do $$
declare trade_id uuid; original_context jsonb;
begin
  select id,entry_context into trade_id,original_context
  from public.trades where trade_idea_id='62000000-0000-0000-0000-000000000002';
  perform set_config('oj_test.trade_id',trade_id::text,true);
  if not exists (
    select 1 from public.trades
    where id=trade_id
      and user_id='61000000-0000-0000-0000-000000000002'
      and originating_catalyst_id='65000000-0000-0000-0000-000000000001'
  ) then raise exception 'User B did not retain private Trade ownership and shared Catalyst provenance'; end if;
  if original_context->>'originating_catalyst_id'<>'65000000-0000-0000-0000-000000000001' then raise exception 'entry context did not preserve originating Catalyst ID'; end if;
  if original_context->>'thesis'<>'Original synthetic thesis.' then raise exception 'entry thesis was not captured'; end if;
  if (original_context#>>'{candidate,planned_debit}')::numeric<>2.1 or (original_context#>>'{actual,debit}')::numeric<>1.98 then raise exception 'planned and actual values were not preserved separately'; end if;
  perform public.record_trade_checkin(trade_id,'weaker','2026-08-14T14:00:00Z','{"what_changed":"Synthetic change.","price_changed":true,"catalyst_changed":false,"volatility_changed":true,"macro_changed":false,"planned_exit_state":"reassess","invalidation_occurred":false}','Synthetic management revision.');
  insert into public.journal_reviews(id,trade_idea_id,trade_id,user_id,ratings,data,revision,sync_status)
  values ('66000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002',trade_id,'61000000-0000-0000-0000-000000000002','{}','{"reflection":"Private synthetic debrief."}',1,'cloud_draft');
  update public.trade_ideas set data=jsonb_set(data,'{Thesis}','"Later synthetic thesis."'),revision=revision+1
  where id='62000000-0000-0000-0000-000000000002';
  if (select entry_context->>'thesis' from public.trades where id=trade_id)<>'Original synthetic thesis.' then raise exception 'Idea edit rewrote immutable entry thesis'; end if;
  if (select status from public.trades where id=trade_id)<>'active' then raise exception 'weaker Thesis Health changed Trade state'; end if;
end $$;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
do $$
begin
  if (select count(*) from public.trades)<>0 then raise exception 'User A can read User B private Trade'; end if;
  if (select count(*) from public.trade_entries)<>0 then raise exception 'User A can read User B fill'; end if;
  if (select count(*) from public.trade_checkins)<>0 then raise exception 'User A can read User B check-in'; end if;
  if (select count(*) from public.journal_reviews)<>0 then raise exception 'User A can read User B debrief'; end if;
end $$;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
do $$
declare inaccessible_idea uuid := '62000000-0000-0000-0000-000000000004';
begin
  if (select count(*) from public.catalysts where id='65000000-0000-0000-0000-000000000001')<>0 then raise exception 'User C can read inaccessible workspace Catalyst'; end if;
  begin
    insert into public.trade_ideas(
      id,user_id,ticker,strategy,bias,idea_status,research_stage,entry_status,user_confirmed_fill,
      originating_catalyst_id,data,revision
    ) values (
      inaccessible_idea,'61000000-0000-0000-0000-000000000003','BLOCKED','bull-call-spread','Bullish',
      'ready','entry_candidate','not-entered',false,'65000000-0000-0000-0000-000000000001',
      '{"Thesis":"Must not be created."}',1
    );
    raise exception 'User C created an Idea against an inaccessible workspace Catalyst';
  exception when others then
    if sqlerrm not like '%originating catalyst access denied%' then raise; end if;
  end;
  if exists (select 1 from public.trade_ideas where id=inaccessible_idea) then raise exception 'blocked User C Idea survived'; end if;
  begin
    perform public.record_trade_entry_v2(
      '62000000-0000-0000-0000-000000000003',null,'pre_catalyst_anticipation',
      '2026-12-18',100,105,1,'2026-08-13T14:00:00Z',1.98,0,
      'Must not record.',true,false,null
    );
    raise exception 'User C recorded a Trade against an inaccessible workspace Catalyst';
  exception when others then
    if sqlerrm not like '%originating catalyst access denied%' then raise; end if;
  end;
  if exists (select 1 from public.trades where trade_idea_id='62000000-0000-0000-0000-000000000003') then raise exception 'blocked User C Trade survived'; end if;
  if (select count(*) from public.trades)<>0 or (select count(*) from public.trade_entries)<>0
     or (select count(*) from public.trade_checkins)<>0 or (select count(*) from public.journal_reviews)<>0 then
    raise exception 'User C can read User B private lifecycle';
  end if;
end $$;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select public.remove_workspace_member('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
do $$
declare trade_id uuid := current_setting('oj_test.trade_id')::uuid;
begin
  if (select count(*) from public.catalysts where id='65000000-0000-0000-0000-000000000001')<>0 then raise exception 'removed User B retained future workspace Catalyst access'; end if;
  if not exists (
    select 1 from public.trades
    where id=trade_id
      and user_id='61000000-0000-0000-0000-000000000002'
      and originating_catalyst_id='65000000-0000-0000-0000-000000000001'
      and entry_context->>'originating_catalyst_id'='65000000-0000-0000-0000-000000000001'
  ) then raise exception 'member removal mutated existing private Trade provenance'; end if;
  if (select count(*) from public.trade_entries where trade_id=trade_id)<>1 then raise exception 'member removal corrupted fill history'; end if;
  if (select count(*) from public.trade_checkins where trade_id=trade_id)<>1 then raise exception 'member removal corrupted check-in history'; end if;
  if (select count(*) from public.journal_reviews where trade_id=trade_id)<>1 then raise exception 'member removal corrupted debrief history'; end if;
  if (select private.can_access_catalyst('65000000-0000-0000-0000-000000000001')) then raise exception 'removed User B retained Catalyst authorization'; end if;
  perform public.record_trade_exit(trade_id,'2026-08-15T14:00:00Z',2.49,'credit',0.50,'target_reached','intact','before catalyst','Synthetic exit.',true);
  if (select status from public.trades where id=trade_id)<>'closed' then raise exception 'Trade did not close after membership removal'; end if;
  if (select realized_pnl from public.trade_exits where trade_id=trade_id)<>50.00 then raise exception 'realized P/L is incorrect'; end if;
  if (select count(*) from public.trades where status='active')<>0 then raise exception 'closed Trade still contributes to open risk'; end if;
end $$;

reset role;
rollback;
