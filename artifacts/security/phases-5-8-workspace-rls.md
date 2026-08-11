# Phases 5–8 Workspace RLS Review

Date: 2026-08-10

## Boundary

Workspace membership authorizes only shared catalyst research. No policy on account policies, trade Ideas, candidates, trades, entries, exits, journal records, private drafts, conflicts, or offline queues was broadened.

## Controls reviewed

- RLS enabled on every new table; invitation RLS forced.
- Explicit authenticated grants; no reliance on default Data API exposure.
- Workspace invitations have no authenticated table grant or policy.
- Member directory uses a checked RPC and excludes email.
- Workspace membership helpers are security definer with empty search paths and indexed membership lookups.
- Shared writes require an approved active identity, active workspace membership, and current-user authorship.
- Shared thesis insert requires an owner-visible source Idea but copies only safe fields.
- A private fork creates a new owner-scoped Idea and cannot expose the source Idea.
- Activity writes are private and event types are schema-constrained.
- Forecast writes are RPC-only, revision snapshots are browser read-only, and the catalyst timestamp is checked server-side.

## Result

The combined migrations and `phases-5-8-structure.sql` completed successfully inside a rollback transaction against project `ljpcgvqsrgpssqobeznp`. Production was not changed.

The production Security and Performance Advisors were also read. Their current findings predate this undeployed schema: informational no-policy notices for intentionally private `account_invites` and deletion tombstones; an intentional authenticated warning for the narrowly checked activation RPC; a project-setting warning for leaked-password protection; two older unindexed deletion-table foreign keys; and low-traffic unused-index notices. No warning was suppressed or changed in this feature branch. Advisors must be rerun after the five migrations are actually applied so every new security-definer RPC and index is assessed in its deployed form.
