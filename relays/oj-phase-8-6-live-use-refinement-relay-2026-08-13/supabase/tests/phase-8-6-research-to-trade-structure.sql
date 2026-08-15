begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='trades' and column_name='entry_context' and data_type='jsonb') then raise exception 'versioned Trade entry context is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='trades' and column_name='trade_class') then raise exception 'Trade classification is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='trade_checkins' and column_name='thesis_health') then raise exception 'check-in Thesis Health is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='trade_exits' and column_name='exit_reason') then raise exception 'exit reason is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='journal_reviews' and column_name='trade_id') then raise exception 'Trade-linked debrief support is missing'; end if;
  if to_regprocedure('public.record_trade_entry_v2(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)') is null then raise exception 'Record Trade RPC is missing'; end if;
  if to_regprocedure('public.record_trade_checkin(uuid,text,timestamp with time zone,jsonb,text)') is null then raise exception 'Trade check-in RPC is missing'; end if;
  if to_regprocedure('public.record_trade_exit(uuid,timestamp with time zone,numeric,text,numeric,text,text,text,text,boolean)') is null then raise exception 'Trade exit RPC is missing'; end if;
  if to_regprocedure('private.record_trade_entry_v2_impl(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)') is null then raise exception 'private Trade entry implementation is missing'; end if;
  if to_regprocedure('private.record_trade_checkin_impl(uuid,text,timestamp with time zone,jsonb,text)') is null then raise exception 'private Trade check-in implementation is missing'; end if;
  if to_regprocedure('private.can_access_catalyst(uuid)') is null then raise exception 'canonical Catalyst access helper is missing'; end if;
  if to_regclass('public.trade_exit_requests') is null then raise exception 'private exit command table is missing'; end if;
  if not coalesce((select relrowsecurity from pg_class where oid='public.trade_exit_requests'::regclass),false) then raise exception 'exit command RLS is not enabled'; end if;
  if has_table_privilege('anon','public.trade_exit_requests','insert') or has_table_privilege('anon','public.trades','select') then raise exception 'anonymous lifecycle access is forbidden'; end if;
  if has_table_privilege('authenticated','public.trades','insert') or has_table_privilege('authenticated','public.trades','update') or has_table_privilege('authenticated','public.trades','delete') then raise exception 'Trade history must be RPC-only'; end if;
  if has_table_privilege('authenticated','public.trade_entries','insert') or has_table_privilege('authenticated','public.trade_exits','insert') then raise exception 'entry and exit history must be RPC-only'; end if;
  if has_table_privilege('authenticated','public.trade_checkins','insert') or has_table_privilege('authenticated','public.trade_checkins','update') or has_table_privilege('authenticated','public.trade_checkins','delete') then raise exception 'historical check-ins must be RPC-only and append-only'; end if;
  if not has_function_privilege('authenticated','public.record_trade_entry_v2(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)','execute') then raise exception 'approved users need Record Trade access'; end if;
  if has_function_privilege('anon','public.record_trade_exit(uuid,timestamp with time zone,numeric,text,numeric,text,text,text,text,boolean)','execute') then raise exception 'anonymous users must not record exits'; end if;
  if exists (select 1 from pg_proc where oid in ('public.record_trade_entry_v2(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)'::regprocedure,'public.record_trade_checkin(uuid,text,timestamp with time zone,jsonb,text)'::regprocedure) and prosecdef) then raise exception 'public lifecycle wrappers must remain security invoker'; end if;
  if (select count(*) from pg_proc where oid in ('private.record_trade_entry_v2_impl(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)'::regprocedure,'private.record_trade_checkin_impl(uuid,text,timestamp with time zone,jsonb,text)'::regprocedure) and prosecdef and proconfig=array['search_path=""']::text[])<>2 then raise exception 'private lifecycle implementations need locked security-definer scope'; end if;
  if not exists (select 1 from pg_proc where oid='private.can_access_catalyst(uuid)'::regprocedure and prosecdef and proconfig=array['search_path=""']::text[]) then raise exception 'Catalyst access helper needs locked security-definer scope'; end if;
  if position('private.is_workspace_member' in pg_get_functiondef('private.can_access_catalyst(uuid)'::regprocedure))=0 then raise exception 'Catalyst access must reuse canonical workspace membership'; end if;
  if position('private.can_access_catalyst' in pg_get_functiondef('private.record_trade_entry_v2_impl(uuid,uuid,text,date,numeric,numeric,integer,timestamp with time zone,numeric,numeric,text,boolean,boolean,text)'::regprocedure))=0 then raise exception 'Record Trade must validate Catalyst access at entry'; end if;
  if not exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conrelid='public.trades'::regclass
      and constraint_record.confrelid='public.catalysts'::regclass
      and constraint_record.contype='f'
      and array_length(constraint_record.conkey,1)=1
      and constraint_record.conkey[1]=(select attnum from pg_attribute where attrelid='public.trades'::regclass and attname='originating_catalyst_id')
  ) then raise exception 'Trade Catalyst provenance must use a direct Catalyst ID foreign key'; end if;
  if not exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conrelid='public.trade_ideas'::regclass
      and constraint_record.confrelid='public.catalysts'::regclass
      and constraint_record.contype='f'
      and array_length(constraint_record.conkey,1)=1
      and constraint_record.conkey[1]=(select attnum from pg_attribute where attrelid='public.trade_ideas'::regclass and attname='originating_catalyst_id')
  ) then raise exception 'Idea Catalyst provenance must use a direct Catalyst ID foreign key'; end if;
  if exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conrelid in ('public.trades'::regclass,'public.trade_ideas'::regclass)
      and constraint_record.confrelid='public.catalysts'::regclass
      and constraint_record.contype='f'
      and array_length(constraint_record.conkey,1)>1
      and (select attnum from pg_attribute where attrelid=constraint_record.conrelid and attname='originating_catalyst_id')=any(constraint_record.conkey)
  ) then raise exception 'Catalyst provenance must not be owner-bound'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.trades'::regclass and tgname='trade_history_immutable' and not tgisinternal) then raise exception 'Trade entry immutability trigger is missing'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.trade_ideas'::regclass and tgname='trade_idea_originating_catalyst_access' and not tgisinternal) then raise exception 'Idea Catalyst assignment guard is missing'; end if;
  if position('originating_catalyst_id' in pg_get_functiondef('private.guard_trade_history_immutable()'::regprocedure))=0 then raise exception 'Trade Catalyst provenance is not immutable'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.trade_exit_requests'::regclass and tgname='process_trade_exit_request' and not tgisinternal) then raise exception 'atomic exit processor is missing'; end if;
end $$;

rollback;
