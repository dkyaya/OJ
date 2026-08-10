-- Run through a trusted SQL session. Every identity and write is rolled back.
begin;

insert into auth.users(id,email) values
  ('33333333-3333-4333-8333-333333333333','phase45-owner@example.invalid');
update public.profiles
set approved=true, account_role='owner', account_status='active'
where id='33333333-3333-4333-8333-333333333333';

insert into public.account_invites(email_normalized,invited_by,status,expires_at)
values
  ('phase45-invited@example.invalid','33333333-3333-4333-8333-333333333333','pending',now()+interval '1 hour'),
  ('phase45-revoked@example.invalid','33333333-3333-4333-8333-333333333333','pending',now()+interval '1 hour');

insert into public.account_invites(email_normalized,invited_by,status,created_at,expires_at)
values ('phase45-expired@example.invalid','33333333-3333-4333-8333-333333333333','pending',now()-interval '2 hours',now()-interval '1 hour');

insert into auth.users(id,email,email_confirmed_at,encrypted_password) values
  ('44444444-4444-4444-8444-444444444444','phase45-invited@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('55555555-5555-4555-8555-555555555555','phase45-uninvited@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('66666666-6666-4666-8666-666666666666','phase45-revoked@example.invalid',now(),encode(gen_random_bytes(32),'hex')),
  ('77777777-7777-4777-8777-777777777777','phase45-expired@example.invalid',now(),encode(gen_random_bytes(32),'hex'));

update public.account_invites
set status='revoked'
where email_normalized='phase45-revoked@example.invalid';

do $test$
begin
  if not exists (select 1 from public.profiles where id='44444444-4444-4444-8444-444444444444' and account_status='invited' and approved=false) then
    raise exception 'invited profile bootstrap failed';
  end if;
  if not exists (select 1 from public.profiles where id='55555555-5555-4555-8555-555555555555' and account_status='pending' and approved=false) then
    raise exception 'uninvited profile was not gated';
  end if;
end
$test$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.activate_invited_account();

reset role;
do $test$
begin
  if not exists (select 1 from public.profiles where id='44444444-4444-4444-8444-444444444444' and account_status='active' and approved=true and account_role='member') then
    raise exception 'invited account activation failed';
  end if;
  if not exists (select 1 from public.account_invites where email_normalized='phase45-invited@example.invalid' and status='accepted' and accepted_user_id='44444444-4444-4444-8444-444444444444') then
    raise exception 'invitation acceptance state failed';
  end if;
end
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $test$
begin
  begin
    perform public.activate_invited_account();
    raise exception 'uninvited activation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'valid invitation required' then raise; end if;
  end;
end
$test$;

select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $test$
begin
  begin
    perform public.activate_invited_account();
    raise exception 'revoked activation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'valid invitation required' then raise; end if;
  end;
end
$test$;

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
do $test$
begin
  begin
    perform public.activate_invited_account();
    raise exception 'expired activation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'valid invitation required' then raise; end if;
  end;
end
$test$;

select 'passed' as account_invite_activation_and_gating;
rollback;
