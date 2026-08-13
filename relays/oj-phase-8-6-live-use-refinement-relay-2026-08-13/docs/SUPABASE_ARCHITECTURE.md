# Supabase architecture

Supabase stores the canonical owner-scoped application records, revisions, portfolio policy, preferences, and optional mirror jobs. The private Obsidian journal is a portable mirror and historical migration source. The browser uses only the project API URL and publishable key; backend credentials exist only in trusted functions or private migration environments.

## Authentication and allowlist

OJ uses email magic links with PKCE. Production redirects must allow `https://dkyaya.github.io/OJ/`; local development must allow `http://localhost:5173`. New Auth users receive a `profiles` row with `approved=false`. After verifying the owner UUID in Supabase Auth, an administrator changes only that profile to `approved=true`. RLS requires both owner identity and approval for journal access.

The current implementation intentionally has no public signup-driven data access: authenticating alone is insufficient. Never use a backend secret in the browser.

## Version-controlled backend

Apply every file under `supabase/migrations/` in timestamp order, then deploy:

- optional `submit-formalization` with JWT verification for an owner-requested mirror;
- optional `formalization-status` with JWT verification;
- `invite-account` with JWT verification for owner-mediated account invitations;
- `reconcile-publication` without gateway JWT because it validates a timestamped, nonce-protected HMAC request and invokes one trusted transactional RPC.

For local development, install the Supabase CLI, run `supabase start`, `supabase db reset`, and `supabase test db`. Link and push to production only with management credentials stored outside source. Production deployment runs manually through `.github/workflows/deploy-supabase.yml`. It validates the required secrets, compares the local and production migration ledgers, performs a dry run, applies only pending migrations, and deploys all five Edge Functions. The workflow pins its CLI and action versions and serializes production runs.

Migration filenames in Git use the exact timestamp versions recorded in `supabase_migrations.schema_migrations`. Never rename an applied migration or repair production history merely to accommodate a conflicting local timestamp. Reconcile the repository to the verified production ledger and preserve the SQL unchanged.

## Canonical boundary

The public schema is explicitly exposed only where the browser needs it. Authenticated clients may read and update approved owner records, but cannot directly delete tables, mutate trusted workflow state, or directly create confirmed positions. Permanent idea deletion is mediated by an archive-first, exact-confirmation command and private processor. Composite foreign keys bind every trade child to the same `(trade_idea_id,user_id)` owner. Server-only payloads and sync events have no browser grants or policies.

The Idea editor writes the dedicated `trade_ideas.idea_status` field while retaining the compatible `data.Status` value used by existing trade-entry guards and exports. The canonical six-value status vocabulary is documented in `IDEA_WORKFLOW.md`; `deleted_at` remains the independent archive lifecycle.

`catalysts.catalyst_category` holds the refined category taxonomy. `event_type` is retained as legacy provenance, and ambiguous legacy values are not guessed during backfill.

Supabase is the application authority. Commit SHA and note path fields are optional provenance for a private Markdown mirror. Ordinary saves update Supabase directly and never trigger a public Pages build.

## Catalyst-first extension

`20260812025054_catalyst_first_research_foundation.sql` extends the existing Catalyst and Idea tables and adds three owner-scoped tables: `trade_idea_catalysts`, `research_sources`, and append-only `research_snapshots`. It does not duplicate the Calendar, War Room, evidence, mission, forecast, candidate, or Trade systems. See `CATALYST_FIRST_RESEARCH.md` and `RESEARCH_METHODS.md` for product semantics and calculation conventions.

The structural and rolled-back synthetic two-user checks are `supabase/tests/catalyst-first-research-structure.sql` and `supabase/tests/catalyst-first-research-two-user-rls.sql`. Run them through a trusted SQL test session after the migration. The public frontend deliberately treats only missing new ledger tables as a pending-migration condition; other Supabase errors still fail closed.

## Research snapshot lifecycle

`20260813030000_phase_8_5_1_snapshot_lifecycle.sql` preserves `research_snapshots` as the immutable observation ledger and adds `research_snapshot_lifecycle_events` as an append-only owner-scoped state log. A composite foreign key binds every lifecycle event to the same `(snapshot_id,user_id)` owner. Browser roles receive SELECT only through RLS; removal and restoration run through locked-search-path security-definer RPCs that verify the authenticated account is approved and active and that the snapshot belongs to it. Direct browser INSERT, UPDATE, and DELETE remain unavailable for both lifecycle state and original snapshots.

Each event receives a monotonic identity order. The active state is the latest event by that order, which avoids timestamp/UUID tie ambiguity. The remove and restore RPCs serialize changes per snapshot with a transaction advisory lock and are idempotent when the desired state is already current. A restore without a prior removal fails closed.

The frontend partitions all loaded snapshots once into active and removed collections. Every current intelligence/history/calibration consumer uses the active collection; the removed collection is recovery and audit metadata only. Provider cache rows are service-only infrastructure and are not deleted or changed by Research Ledger removal.

Review checks are `supabase/tests/phase-8-5-1-snapshot-lifecycle-structure.sql` and `supabase/tests/phase-8-5-1-snapshot-lifecycle-two-user-rls.sql`. The latter uses rolled-back synthetic users to prove original-row immutability, same-owner remove/restore, and cross-user invisibility and rejection.

## Research-to-Trade lifecycle

`20260813201443_phase_8_6_research_to_trade_lifecycle.sql` extends the existing private Idea/Candidate/Trade model without creating a parallel order model. It adds typed actual vertical fields, explicit Trade classification, a compact versioned entry-context snapshot, structured append-only Check-Ins, typed full Exits, and a Trade link for Journal reviews.

Browser roles retain owner-scoped reads but cannot directly insert, update, or delete Trade, entry, Check-In, or Exit history. Public `security invoker` functions expose the narrow authenticated API. Locked-search-path private implementations perform ownership, approval, lifecycle, payoff, confirmation, and risk-acknowledgement checks before writing. Exit recording uses an insert-only RLS command row and private trigger so Exit creation and Trade closure remain atomic. Entry provenance columns are guarded from later mutation.

Idea and Trade Catalyst provenance uses a direct foreign key to `catalysts.id`, not an owner-bound composite key. The locked `private.can_access_catalyst` helper reuses `private.is_workspace_member`: a Catalyst is assignable when it is private and owned by the authenticated user, or workspace-visible with active membership in its unarchived workspace. The protected Record Trade implementation repeats that authorization at entry time. The direct `ON DELETE RESTRICT` relationship and immutable Trade context preserve recorded provenance after later membership removal while RLS and the helper remove future workspace access.

The migration does not seed or rewrite private account preferences. Production inspection confirmed the owner policy already stores an $800 maximum-open-options-risk ceiling. Structural and rolled-back synthetic three-user checks are `supabase/tests/phase-8-6-research-to-trade-structure.sql` and `supabase/tests/phase-8-6-research-to-trade-two-user-rls.sql` (the retained filename is stable even though the scenario now covers Users A, B, and C). Product semantics are documented in `RESEARCH_TO_TRADE_LIFECYCLE.md`.
