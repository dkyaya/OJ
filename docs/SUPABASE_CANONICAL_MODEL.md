# Supabase Canonical Model

Supabase owns live OJ application state. Every private table uses `user_id`, approved-account Row Level Security, and explicit grants. Browser code receives only the project URL and publishable key.

## Record Families

- `trade_ideas`, `trade_candidates`, `catalysts`, `catalyst_security_mappings`, and `research_annotations` store research.
- `trades`, `trade_entries`, `trade_checkins`, `trade_exits`, and `journal_reviews` store confirmed lifecycle and review records.
- `account_policies` stores the current rule; `account_policy_history` preserves every version.
- `application_preferences` stores display defaults.
- `record_revisions` stores append-only snapshots; `migration_registry` makes historical imports idempotent and traceable.

Every mutable canonical record has a revision. Client updates compare the known revision, and a zero-row result is treated as a device conflict. IndexedDB is an offline cache and retry queue, never a separate authority.

Supabase Auth owns email/password credentials and persistent sessions. `profiles` adds display metadata plus a protected `owner` / `member` app role and account status. `account_invites` is server-managed and intentionally has no browser-readable RLS policy. A verified, active, approved profile is required by the shared private authorization helper.

`record_trade_entry` is an atomic, narrowly granted caller-context operation. It inserts one owner-scoped command; a non-exposed private trigger validates and applies the lifecycle change. Direct browser inserts and updates on confirmed positions are revoked. The operation requires an approved user, explicit actual-fill confirmation, eligible research status, positive contracts, a timestamp, maximum risk, and a current account policy; it blocks aggregate risk above the policy limit. It creates a confirmed position and entry and advances the source idea together. OJ never talks to a brokerage.

Legacy `formalization_jobs` and related Edge Functions remain isolated for optional Markdown mirrors and exports. Ordinary saves do not invoke them.
