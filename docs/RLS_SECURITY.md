# RLS security

Every public user-data table has RLS enabled. Editable browser rows require `(select auth.uid()) = user_id` and the private approved-profile helper. Formalization jobs, immutable payloads, sync events, and publication references are browser read-only for their owner. Anonymous users have no journal policies.

Database triggers add defense in depth:

- a profile cannot approve itself;
- ownership cannot be transferred;
- publication fields are trusted-only;
- browser writes may produce only `cloud_draft`;
- browser revisions must increment exactly once;
- browser deletion is disabled;
- trusted workflows control submission, PR, merge, and publication states.

The allowlist helper lives in an unexposed schema and is not executable by anonymous users. Production Supabase security advisors report zero findings after the hardening migrations.

Run `supabase test db` against a local project to execute `supabase/tests/rls.sql`. The test suite checks explicit RLS, hidden helpers, missing delete policies, self-approval protection, and the browser state guard. A safe two-user staging pass should additionally exercise owner reads, non-owner denial, forged inserts, ownership mutation, soft deletion, and privileged job transitions before multi-user access is ever enabled.
