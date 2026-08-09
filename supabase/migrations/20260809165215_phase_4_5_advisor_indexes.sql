create index account_invites_invited_by_idx on public.account_invites(invited_by);
create index account_invites_accepted_user_id_idx on public.account_invites(accepted_user_id);
create index trade_entry_requests_idea_owner_idx on public.trade_entry_requests(trade_idea_id, user_id);
