-- Make server-only access explicit and add covering indexes for composite ownership FKs.

create policy formalization_payloads_service_only on public.formalization_payloads
  for all to service_role using (true) with check (true);
create policy sync_events_service_only on public.sync_events
  for all to service_role using (true) with check (true);
create policy reconciliation_nonces_service_only on private.reconciliation_nonces
  for all to service_role using (true) with check (true);

create index catalysts_trade_owner_idx on public.catalysts(trade_idea_id, user_id);
create index research_annotations_trade_owner_idx on public.research_annotations(trade_idea_id, user_id);
create index trade_candidates_trade_owner_idx on public.trade_candidates(trade_idea_id, user_id);
create index trade_entries_trade_owner_idx on public.trade_entries(trade_idea_id, user_id);
create index trade_checkins_trade_owner_idx on public.trade_checkins(trade_idea_id, user_id);
create index trade_exits_trade_owner_idx on public.trade_exits(trade_idea_id, user_id);
create index journal_reviews_trade_owner_idx on public.journal_reviews(trade_idea_id, user_id);
create index formalization_payloads_job_owner_idx on public.formalization_payloads(job_id, user_id);
