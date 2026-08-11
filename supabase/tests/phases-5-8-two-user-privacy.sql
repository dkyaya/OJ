-- Run through a trusted SQL session after all migrations. Synthetic identities and writes roll back.
begin;

insert into auth.users(id,email,email_confirmed_at,encrypted_password) values
  ('51111111-1111-4111-8111-111111111111','workspace-owner@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('52222222-2222-4222-8222-222222222222','workspace-member@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('53333333-3333-4333-8333-333333333333','workspace-outsider@example.invalid',now(),encode(gen_random_bytes(32),'hex'));
update public.profiles set approved=true, account_status='active', display_name='Workspace Owner', initials='WO'
where id='51111111-1111-4111-8111-111111111111';
update public.profiles set approved=true, account_status='active', display_name='Workspace Member', initials='WM'
where id='52222222-2222-4222-8222-222222222222';
update public.profiles set approved=true, account_status='active', display_name='Outside User', initials='OU'
where id='53333333-3333-4333-8333-333333333333';
update public.profiles set account_role='owner' where id='51111111-1111-4111-8111-111111111111';

insert into public.workspaces(id,name,created_by) values
  ('50000000-0000-4000-8000-000000000001','Synthetic Research Desk','51111111-1111-4111-8111-111111111111');
insert into public.workspace_members(workspace_id,user_id,workspace_role) values
  ('50000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','owner'),
  ('50000000-0000-4000-8000-000000000001','52222222-2222-4222-8222-222222222222','member');
insert into public.trade_ideas(id,user_id,ticker,strategy,bias,data) values
  ('5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','51111111-1111-4111-8111-111111111111','PRIVATE1','bear-put-spread','bearish','{"Status":"Ready","Thesis":"owner private"}'),
  ('5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','52222222-2222-4222-8222-222222222222','PRIVATE2','bull-call-spread','bullish','{"Status":"Ready","Thesis":"member private"}');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);

insert into public.catalysts(id,user_id,event,event_type,event_at,data,workspace_id,created_by,updated_by,visibility)
values
  ('5c111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111','Future shared event','Other',now()+interval '7 days','{}','50000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111','workspace'),
  ('5c222222-2222-4222-8222-222222222222','51111111-1111-4111-8111-111111111111','Owner private event','Other',now()+interval '8 days','{}',null,'51111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111','private'),
  ('5c333333-3333-4333-8333-333333333333','51111111-1111-4111-8111-111111111111','Past shared event','Other',now()-interval '1 hour','{}','50000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111','workspace');

insert into public.research_missions(id,workspace_id,catalyst_id,title,status,created_by)
values ('5d111111-1111-4111-8111-111111111111','50000000-0000-4000-8000-000000000001','5c111111-1111-4111-8111-111111111111','Synthetic mission','active','51111111-1111-4111-8111-111111111111');

insert into public.shared_theses(id,workspace_id,author_id,source_trade_idea_id,catalyst_id,ticker,strategy,bias,thesis_summary,confidence)
values ('5e111111-1111-4111-8111-111111111111','50000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','5c111111-1111-4111-8111-111111111111','SYNTH','bear-put-spread','bearish','Only the safe shared thesis summary.',60);

do $test$
declare c integer; v_forecast_id uuid;
begin
  select count(*) into c from public.trade_ideas;
  if c <> 1 then raise exception 'owner saw % private ideas instead of exactly their own', c; end if;
  select count(*) into c from public.catalysts;
  if c <> 3 then raise exception 'owner catalyst visibility incorrect: %', c; end if;
  begin perform public.complete_research_mission('5d111111-1111-4111-8111-111111111111','no_trade');
    raise exception 'mission completed without evidence';
  exception when raise_exception then if sqlerrm <> 'add evidence before completing the mission' then raise; end if; end;

  v_forecast_id := public.save_personal_forecast(null,'50000000-0000-4000-8000-000000000001','5c111111-1111-4111-8111-111111111111','5d111111-1111-4111-8111-111111111111','Synthetic owner forecast','{}','bearish',1.2,'percent',62,'SYNTH','bear-put-spread','watch','private',null,null);
  perform public.lock_personal_forecast(v_forecast_id,1);
  select count(*) into c from public.forecast_revisions where forecast_id=v_forecast_id;
  if c <> 2 then raise exception 'draft plus locked immutable snapshots not created: %', c; end if;
  begin
    perform public.save_personal_forecast(null,'50000000-0000-4000-8000-000000000001','5c333333-3333-4333-8333-333333333333',null,'Late forecast','{}','bullish',1,'percent',50,null,null,'watch','private',null,null);
    raise exception 'post-cutoff forecast unexpectedly succeeded';
  exception when raise_exception then if sqlerrm <> 'the pre-event forecast cutoff has passed' then raise; end if; end;
end
$test$;

select set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
insert into public.evidence_cards(id,workspace_id,catalyst_id,mission_id,author_id,evidence_type,title,summary,verification_status,last_verified_at)
values ('5f111111-1111-4111-8111-111111111111','50000000-0000-4000-8000-000000000001','5c111111-1111-4111-8111-111111111111','5d111111-1111-4111-8111-111111111111','52222222-2222-4222-8222-222222222222','neutral','Synthetic evidence','A shared factual observation with no private risk data.','verified',now());
select public.set_mission_checkpoint('5d111111-1111-4111-8111-111111111111','event_verified',true,'Official schedule checked.');
select public.complete_research_mission('5d111111-1111-4111-8111-111111111111','no_trade');

do $test$
declare c integer; fork_id uuid; shared_forecast uuid;
begin
  select count(*) into c from public.trade_ideas;
  if c <> 1 then raise exception 'member saw owner private idea'; end if;
  select count(*) into c from public.catalysts;
  if c <> 2 then raise exception 'member saw owner private catalyst or missed shared catalysts: %', c; end if;
  select count(*) into c from public.shared_theses;
  if c <> 1 then raise exception 'member could not read shared thesis'; end if;
  select count(*) into c from public.personal_forecasts;
  if c <> 0 then raise exception 'member saw owner private forecast'; end if;
  fork_id := public.fork_shared_thesis('5e111111-1111-4111-8111-111111111111');
  if not exists (select 1 from public.trade_ideas where id=fork_id and user_id='52222222-2222-4222-8222-222222222222' and data->>'shared_thesis_id'='5e111111-1111-4111-8111-111111111111') then
    raise exception 'shared thesis did not create an independent private fork';
  end if;
  shared_forecast := public.save_personal_forecast(null,'50000000-0000-4000-8000-000000000001','5c111111-1111-4111-8111-111111111111','5d111111-1111-4111-8111-111111111111','Synthetic member viewpoint','{}','neutral',0.4,'percent',55,'SYNTH',null,'no_trade','workspace',null,null);
  perform public.lock_personal_forecast(shared_forecast,1);
  if not exists (select 1 from public.research_missions where id='5d111111-1111-4111-8111-111111111111' and status='completed' and completed_decision='no_trade') then
    raise exception 'No Trade mission completion was not preserved';
  end if;
end
$test$;

select set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.personal_forecasts;
  if c <> 2 then raise exception 'owner should see own private plus member shared forecast: %', c; end if;
  if exists (select 1 from public.activity_events where object_type in ('trade','trades','trade_idea','trade_ideas','account_policy','journal')) then
    raise exception 'private object type leaked into shared activity';
  end if;
  if exists (select 1 from public.activity_events where event_type not in ('member_joined','member_left','member_removed','evidence_added','evidence_responded','thesis_shared','thesis_responded','thesis_forked','mission_created','mission_updated','question_added','liquidity_added','forecast_shared','debrief_added')) then
    raise exception 'non-allowlisted shared activity recorded';
  end if;
end
$test$;

select public.remove_workspace_member('50000000-0000-4000-8000-000000000001','52222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.workspaces; if c <> 0 then raise exception 'removed member retained workspace access'; end if;
  select count(*) into c from public.evidence_cards; if c <> 0 then raise exception 'removed member retained evidence access'; end if;
  select count(*) into c from public.personal_forecasts; if c <> 1 then raise exception 'removed member should retain only their own forecast: %', c; end if;
  if exists (select 1 from public.personal_forecasts where user_id <> '52222222-2222-4222-8222-222222222222') then raise exception 'removed member retained another user forecast'; end if;
end
$test$;

select set_config('request.jwt.claim.sub','53333333-3333-4333-8333-333333333333',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.workspaces; if c <> 0 then raise exception 'outsider saw workspace'; end if;
  select count(*) into c from public.evidence_cards; if c <> 0 then raise exception 'outsider saw evidence'; end if;
  select count(*) into c from public.shared_theses; if c <> 0 then raise exception 'outsider saw shared thesis'; end if;
  select count(*) into c from public.research_missions; if c <> 0 then raise exception 'outsider saw mission'; end if;
  select count(*) into c from public.personal_forecasts; if c <> 0 then raise exception 'outsider saw forecast'; end if;
  begin perform count(*) from public.workspace_invites; raise exception 'outsider enumerated invitations';
  exception when insufficient_privilege then null; end;
end
$test$;

select 'passed' as phases_5_8_two_user_privacy_and_workflows;
rollback;
