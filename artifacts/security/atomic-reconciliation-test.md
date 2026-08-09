# Atomic publication-reconciliation test

- Environment: production Supabase schema, inside rollback-only transactions
- Executed: 2026-08-05
- Persistent records created: none
- Result: **20 of 20 assertions passed**

## Rejection behavior

- Rejected a mismatched job, pull request, revision, commit format, branch, note path, and payload hash.
- Rejected a deliberately injected mid-transaction failure without leaving a publication row or partially changing the source/job state.
- Rejected reuse of a reconciliation nonce.
- Rejected an attempt to publish the same revision with a different canonical commit.

## Success and retry behavior

- A valid reconciliation atomically updated the source record, immutable payload, job, published-record receipt, and sync event.
- A repeated callback for the same canonical commit was idempotent and did not create a duplicate sync event.
- Row locks and unique constraints protect the job, source revision, publication identity, and callback nonce.

The public Edge endpoint was also checked for `405 method_not_allowed`, `401 stale_callback`, and `401 invalid_signature` responses without disclosing secrets or payload contents. A full signed GitHub merge callback remains gated on installing the dedicated GitHub App and its secret values.
