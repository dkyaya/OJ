# Supabase Canonical Model

Supabase owns live OJ application state. Every private table uses `user_id`, approved-account Row Level Security, and explicit grants. Browser code receives only the project URL and publishable key.

## Record Families

- `trade_ideas`, `trade_candidates`, `catalysts`, `catalyst_security_mappings`, and `research_annotations` store research.
- `trades`, `trade_entries`, `trade_checkins`, `trade_exits`, and `journal_reviews` store confirmed lifecycle and review records.
- `account_policies` stores the current rule; `account_policy_history` preserves every version.
- `application_preferences` stores display defaults.
- `record_revisions` stores append-only snapshots; `migration_registry` makes historical imports idempotent and traceable.

Every mutable canonical record has a revision. Client updates compare the known revision, and a zero-row result is treated as a device conflict. IndexedDB is an offline cache and retry queue, never a separate authority.

`set_trade_idea_archived` is the browser-callable archive/restore path. It runs in the caller's RLS context, owner-locks the row, compares the exact expected revision, changes only `deleted_at`, and advances the revision. A private trigger refuses to archive any idea with confirmed active or closed trade history. Archived ideas remain canonical and exportable but are excluded from active counts, opportunity mappings, and entry selection.

Permanent deletion is a separate archive-first command. `delete_trade_idea` inserts an owner-scoped, revision-checked request; an unexposed private processor accepts only the exact `DELETE TICKER` phrase and refuses any trade or journal history. It deletes research-only children and idea mirror metadata while detaching shared calendar catalysts. Browser roles never receive table `DELETE` access. A content-free tombstone prevents stale devices from recreating the deleted UUID. Archive, restore, and delete all fail closed offline rather than entering the draft retry queue.

Supabase Auth owns email/password credentials and persistent sessions. `profiles` adds display metadata plus a protected `owner` / `member` app role and account status. `account_invites` is server-managed and intentionally has no browser-readable RLS policy. A verified, active, approved profile is required by the shared private authorization helper.

`record_trade_entry` is an atomic, narrowly granted caller-context operation. It inserts one owner-scoped command; a non-exposed private trigger validates and applies the lifecycle change. Direct browser inserts and updates on confirmed positions are revoked. The operation requires an approved user, explicit actual-fill confirmation, eligible research status, positive contracts, a timestamp, maximum risk, and a current account policy; it blocks aggregate risk above the policy limit. It creates a confirmed position and entry and advances the source idea together. OJ never talks to a brokerage.

Legacy `formalization_jobs` and related Edge Functions remain isolated for optional Markdown mirrors and exports. Ordinary saves do not invoke them.

## Shared research families

`workspaces`, `workspace_members`, and server-managed `workspace_invites` add an authorization layer that is independent of account roles. Shared catalysts and security mappings carry a workspace scope; private research annotations remain user-owned.

`evidence_cards`, `evidence_responses`, `shared_theses`, and `shared_thesis_responses` contain explicit collaboration artifacts. A shared thesis stores only ticker, bias, normalized defined-risk strategy, reviewed summary, optional expected move, and optional confidence. `fork_shared_thesis` creates a new owner-scoped Idea; later edits never sync back across the boundary.

`research_missions`, assignments, questions, liquidity observations, and checkpoints coordinate catalyst research. `complete_research_mission` requires evidence and an event-verification checkpoint, but accepts Trade, Watch, or No Trade.

`personal_forecasts` remain user-owned. Visibility can explicitly expose a forecast to workspace members, while `forecast_revisions` preserve immutable draft and locked snapshots. Forecast writes and locks use server-checked RPCs that enforce the catalyst timestamp cutoff. Debriefs can be private or shared; personal lessons remain in the private Journal.
