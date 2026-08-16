-- Canonical Idea editor structure, revision behavior, and owner isolation.
-- Run through a trusted SQL session after all migrations. Every write rolls back.
begin;

insert into auth.users(id,email) values
  ('71111111-1111-4111-8111-111111111111','idea-editor-a@example.invalid'),
  ('72222222-2222-4222-8222-222222222222','idea-editor-b@example.invalid');
update public.profiles set approved=true, account_status='active'
where id in ('71111111-1111-4111-8111-111111111111','72222222-2222-4222-8222-222222222222');

insert into public.trade_ideas(id,user_id,ticker,strategy,bias,idea_status,data) values
  ('71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','71111111-1111-4111-8111-111111111111','SYNTHA','bear-put-spread','bearish','draft','{"Status":"Draft","Thesis":"Before"}'),
  ('72bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','72222222-2222-4222-8222-222222222222','SYNTHB','bull-call-spread','bullish','watchlist','{"Status":"Watchlist"}');
insert into public.trade_candidates(id,trade_idea_id,user_id,name,data) values
  ('71cccccc-cccc-4ccc-8ccc-ccccccccccc1','71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','71111111-1111-4111-8111-111111111111','Candidate','{"label":"Candidate","long_strike":100}'),
  ('72dddddd-dddd-4ddd-8ddd-ddddddddddd2','72bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','72222222-2222-4222-8222-222222222222','Balanced','{"label":"Balanced","long_strike":200}');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);

do $test$
declare c integer; trade_count integer;
begin
  if position('old.deleted_at' in lower(pg_get_functiondef('private.reject_revision_only_update()'::regprocedure))) > 0 then
    raise exception 'shared revision trigger reads a Trade-Idea-only field directly';
  end if;
  select count(*) into c from public.trade_ideas;
  if c <> 1 then raise exception 'user A could see % Idea rows', c; end if;

  perform public.save_trade_idea_edit(
    '71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,
    '{"ticker":"SYNTHA2","underlying_type":"ETF","strategy":"bear-put-spread","bias":"Bearish","idea_status":"ready","confidence":"Moderate","planned_hold_through_events":[],"planned_avoid_events":[],"contracts":1,"data":{"Status":"Ready","Thesis":"After","Long strike":"101"}}'::jsonb,
    '71cccccc-cccc-4ccc-8ccc-ccccccccccc1',
    '{"enabled":true,"long_strike":101,"short_strike":98,"debit":1,"contracts":1,"max_loss":100,"max_profit":200,"break_even":100}'::jsonb
  );
  select count(*) into c from public.record_revisions
  where user_id='71111111-1111-4111-8111-111111111111'
    and record_type='trade_ideas' and record_id='71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and revision=2;
  if c <> 1 then raise exception 'successful Idea edit did not create revision 2'; end if;

  begin
    update public.trade_ideas set revision=revision+1, updated_at=now()
    where id='71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'no-op Idea update unexpectedly created a revision';
  exception when raise_exception then
    if sqlerrm <> 'no changes to save' then raise; end if;
  end;

  update public.trade_ideas set ticker='CROSS', revision=revision+1, updated_at=now()
  where id='72bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'user A edited user B Idea'; end if;

  select count(*) into c from public.record_revisions
  where user_id='71111111-1111-4111-8111-111111111111'
    and record_type='trade_candidates' and record_id='71cccccc-cccc-4ccc-8ccc-ccccccccccc1' and revision=2;
  if c <> 1 then raise exception 'atomic edit did not create candidate revision 2'; end if;

  update public.trade_candidates
  set data=data || '{"long_strike":102}'::jsonb, revision=revision+1, updated_at=now()
  where id='71cccccc-cccc-4ccc-8ccc-ccccccccccc1';
  get diagnostics c = row_count;
  if c <> 1 then raise exception 'user A could not edit the owned candidate'; end if;
  update public.trade_candidates
  set data=data || '{"long_strike":201}'::jsonb, revision=revision+1, updated_at=now()
  where id='72dddddd-dddd-4ddd-8ddd-ddddddddddd2';
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'user A edited user B candidate'; end if;

  select count(*) into trade_count from public.trades where trade_idea_id='71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if trade_count <> 0 then raise exception 'Idea metadata edit fabricated trade provenance'; end if;

  perform public.set_trade_idea_archived('71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',2,true);
  begin
    update public.trade_ideas set ticker='ARCHIVED-EDIT', revision=revision+1, updated_at=now()
    where id='71aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'archived Idea was editable before restore';
  exception when raise_exception then
    if sqlerrm <> 'restore the archived idea before editing it' then raise; end if;
  end;
end
$test$;

select set_config('request.jwt.claim.sub','72222222-2222-4222-8222-222222222222',true);
do $test$
declare c integer;
begin
  select count(*) into c from public.trade_ideas;
  if c <> 1 then raise exception 'user B could see % Idea rows', c; end if;
  select count(*) into c from public.trade_candidates;
  if c <> 1 then raise exception 'user B could see % candidate rows', c; end if;
end
$test$;

select 'passed' as idea_editing_canonical_schema_and_two_user_rls;
rollback;
