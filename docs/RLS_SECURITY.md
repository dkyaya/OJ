# RLS security

Every exposed user-data table has RLS enabled. Policies explicitly target `authenticated`, require a non-null `(select auth.uid())`, direct ownership, server-controlled approval, and parent ownership where applicable. Composite foreign keys enforce same-owner parent/child relationships. Confirmed positions are read-only to browser table access and are created through the validated entry RPC. Optional formalization jobs and mirror records are owner read-only; immutable payloads and trusted sync events are server-only. Anonymous users have no table grants or journal policies.

Database triggers add defense in depth:

- browser clients cannot update a profile or approve themselves;
- ownership cannot be transferred;
- publication fields are trusted-only;
- browser writes may produce only `cloud_draft`;
- browser revisions must increment exactly once;
- browser deletion is disabled;
- archive and restore use a narrowly granted, owner-scoped, revision-checked function;
- research with confirmed active or closed trade history cannot be archived;
- archived research cannot enter the confirmed-trade processor;
- trusted workflows control submission, PR, merge, and publication states.

The allowlist helper uses a safe empty search path, lives in an unexposed schema, and is not executable by anonymous users. Every security-definer function has explicit permissions and a safe search path. No Storage buckets or Realtime publication tables are required in this version.

The production-safe behavioral test uses synthetic users inside a rolled-back transaction and exercises real RLS as `authenticated`: owner access, cross-owner denial, forged ownership, child-parent mismatch, ownership mutation, self-approval, deletion denial, server-only records, and anonymous denial. See `artifacts/security/two-user-rls-test.md`.
