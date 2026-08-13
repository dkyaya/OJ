begin;

insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('61000000-0000-0000-0000-000000000001','trade-a@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('61000000-0000-0000-0000-000000000002','trade-b@example.test','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

update public.profiles set approved=true,account_status='active' where id in ('61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');

insert into public.account_policies(user_id,total_account_capital,maximum_open_options_risk,preferred_defined_risk_strategies,effective_date,policy_version)
values
  ('61000000-0000-0000-0000-000000000001',5000,800,array['bull-call-spread'],'2026-08-13',1),
  ('61000000-0000-0000-0000-000000000002',5000,800,array['bull-call-spread'],'2026-08-13',1);

insert into public.trade_ideas(id,user_id,ticker,strategy,bias,idea_status,research_stage,entry_status,user_confirmed_fill,data,revision)
values
  ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','SYNTH','bull-call-spread','Bullish','ready','entry_candidate','not-entered',false,'{"Thesis":"Original synthetic thesis.","Evidence":"Synthetic evidence.","Invalidation":"Synthetic invalidation.","Planned exit":"Synthetic planned exit."}',1),
  ('62000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','OTHER','bull-call-spread','Bullish','ready','entry_candidate','not-entered',false,'{"Thesis":"Other user thesis."}',1);

insert into public.trade_candidates(id,trade_idea_id,user_id,name,data,revision)
values
  ('63000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','Candidate','{"expiration":"2026-12-18","long_strike":100,"short_strike":105,"debit":2.1,"contracts":1,"max_loss":210,"max_profit":290,"break_even":102.1}',1),
  ('63000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','Candidate','{"expiration":"2026-12-18","long_strike":100,"short_strike":105,"debit":2.1,"contracts":1}',1);

set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_trade_entry_v2('62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','pre_catalyst_anticipation','2026-12-18',100,105,1,'2026-08-13T14:00:00Z',1.98,0.50,'Synthetic execution.',true,false,null);

do $$
declare trade_id uuid; original_context jsonb;
begin
  select id,entry_context into trade_id,original_context from public.trades where trade_idea_id='62000000-0000-0000-0000-000000000001';
  perform set_config('oj_test.trade_id',trade_id::text,true);
  if original_context->>'thesis'<>'Original synthetic thesis.' then raise exception 'entry thesis was not captured'; end if;
  if (original_context#>>'{candidate,planned_debit}')::numeric<>2.1 or (original_context#>>'{actual,debit}')::numeric<>1.98 then raise exception 'planned and actual values were not preserved separately'; end if;
  perform public.record_trade_checkin(trade_id,'weaker','2026-08-14T14:00:00Z','{"what_changed":"Synthetic change.","price_changed":true,"catalyst_changed":false,"volatility_changed":true,"macro_changed":false,"planned_exit_state":"reassess","invalidation_occurred":false}','Synthetic management revision.');
  update public.trade_ideas set data=jsonb_set(data,'{Thesis}','"Later synthetic thesis."'),revision=revision+1 where id='62000000-0000-0000-0000-000000000001';
  if (select entry_context->>'thesis' from public.trades where id=trade_id)<>'Original synthetic thesis.' then raise exception 'Idea edit rewrote immutable entry thesis'; end if;
  if (select status from public.trades where id=trade_id)<>'active' then raise exception 'weaker Thesis Health changed Trade state'; end if;
end $$;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);

do $$
declare user_a_trade uuid := current_setting('oj_test.trade_id')::uuid;
begin
  if (select count(*) from public.trades)<>0 then raise exception 'User B can read User A Trade'; end if;
  if (select count(*) from public.trade_checkins)<>0 then raise exception 'User B can read User A check-in'; end if;
  begin
    perform public.record_trade_checkin(user_a_trade,'intact',now(),'{}',null);
    raise exception 'User B mutated User A Trade';
  exception when others then
    if sqlerrm not like '%active trade not found%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);

do $$
declare trade_id uuid := (select id from public.trades where trade_idea_id='62000000-0000-0000-0000-000000000001');
begin
  perform public.record_trade_exit(trade_id,'2026-08-15T14:00:00Z',2.49,'credit',0.50,'target_reached','intact','before catalyst','Synthetic exit.',true);
  if (select status from public.trades where id=trade_id)<>'closed' then raise exception 'Trade did not close'; end if;
  if (select realized_pnl from public.trade_exits where trade_id=trade_id)<>50.00 then raise exception 'realized P/L is incorrect'; end if;
  if (select count(*) from public.trades where status='active')<>0 then raise exception 'closed Trade still contributes to open risk'; end if;
end $$;

reset role;
rollback;
