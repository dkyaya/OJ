# Two-user RLS behavioral test

- Environment: production Supabase schema, inside a single rollback-only database transaction
- Executed: 2026-08-05
- Identities: synthetic approved owner A, synthetic approved owner B, and anonymous
- Persistent records created: none (the transaction ended with `ROLLBACK`)
- Result: **57 of 57 assertions passed**

## Owner A

- Created, read, and updated each of the eight browser-writable owner tables.
- Updated only the exact current revision.
- Could not perform an illegal lifecycle transition.
- Could not mutate record ownership.
- Could not delete browser-managed journal records.
- Could not approve their own profile.
- Could read their own formalization-job and publication receipts.
- Could not read server-only immutable payloads or sync-event internals.

## Owner B and forged ownership

- Could not read or update any owner-A journal row.
- Could not attach a child record to owner A's parent record.
- Could not create a record carrying owner A's user identifier.
- Could not guess and read owner A's immutable formalization payload.
- Could not see or mutate owner A's jobs or publication receipts.

## Anonymous and realtime checks

- Anonymous reads and writes were denied.
- Journal tables were not members of the `supabase_realtime` publication.

This test is behavioral evidence, not a replacement for the migration and policy review in `docs/RLS_SECURITY.md`.
