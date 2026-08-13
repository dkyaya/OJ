# OJ Phase 8.5.1 — Catalyst Intelligence Usability and Snapshot Lifecycle

Date: 2026-08-13

Repository: `dkyaya/OJ`

Branch: `feature/phase-8-5-1-intelligence-usability`

Baseline: `b0a95dc76f537bbb4f64e8e68964cb71d96daeec`

Implementation HEAD: `352e7cdc91a55db692955593971f22da7126786a`

Draft PR title: `Polish Catalyst Intelligence and add snapshot removal`

## A. Baseline and architecture inspected

The branch starts from the Phase 8.5 mainline after PR #20. The review covered the public React/TypeScript/Vite application, Supabase migrations and RLS conventions, Catalyst Intelligence provider gateway, `MarketSnapshot` normalization, Research Ledger loading/actions, calibration/IV/timeline consumers, provider cache boundary, documentation, CI, and the existing repository privacy/copy checks.

Existing systems were reused:

- `research_snapshots` remains the private append-only observation ledger.
- `catalyst_provider_cache` remains a separate service-only infrastructure cache.
- `workspace.researchSnapshots` remains the single input to Catalyst Intelligence, export, and Research Ledger active views.
- Existing midpoint and straddle-implied-move analytics are reused; there is no duplicate pricing formula.
- No new navigation, provider, paid data dependency, broker access, order route, or trade automation was added.

## B. Root cause

### Unreadable option-chain snapshots

`ResearchLedger.tsx` treated every `values` entry as a scalar and converted nested objects/arrays with one-line `JSON.stringify`. A normalized `values.option_chain` is an array of many contract objects, so correct provider data became an unreadable inline wall with no strike pairing, provenance hierarchy, ATM context, or mobile affordance.

### Missing snapshot lifecycle

The observation table correctly allowed authenticated owner SELECT and INSERT only. It had no normal UPDATE or DELETE path—which preserved history—but also no safe way to suppress test, duplicate, or erroneous observations from analytics. A new lifecycle layer was required without mutating or deleting original rows.

## C. Option-chain UX implementation

### Components and transformation

- `app/src/components/OptionChainSnapshot.tsx`
- `app/src/lib/catalyst-intelligence/option-chain.ts`
- `app/src/test/fixtures/wmt-option-chain.ts`

The parser accepts stored camel-case normalized contracts and compatible snake-case legacy keys. Malformed entries are ignored without throwing. Contracts are grouped by strike and paired as calls/puts. Duplicate same-side records resolve deterministically: the record with more usable fields wins, followed by the later retrieval time and stable symbol ordering.

The primary view shows:

- ticker and human-readable expiration;
- underlying price and contract count;
- provider and prominent freshness badge;
- distinct observed and fetched timestamps;
- source and `New provider response cached` versus `Private cache hit` status;
- paired Call Bid/Ask/Mid/IV, Strike, Put IV/Mid/Bid/Ask columns;
- collapsed volume, open interest, last, symbol, and Greeks under **Contract Details**;
- pretty normalized payload under collapsed **Technical Details**.

Unknown structured values never enter the primary metric grid. Recognized primitive metrics remain compact.

### ATM and implied move

Nearest ATM minimizes absolute distance from the stored underlying price. An exact tie uses the lower strike, documented in code, tests, UI copy, and pricing documentation. No underlying means no ATM guess. The summary uses the existing `midpoint()` and `straddleImpliedMove()` analytics on the same-strike call/put only. A missing side yields no fabricated summary.

### Manual/provider comparison

Research Ledger observations with the same ticker and expiration are presented side by side when one is manual and one is provider-derived. Each retains provider/source, freshness, and observation timestamp. OJ does not calculate an unlabeled difference or imply that observations from different times are apples-to-apples.

### Responsive behavior

Desktop and tablet use the paired table. Narrow widths retain readable 10px mono data in a horizontally scrollable, focusable container rather than crushing nine columns. Provenance, ATM summary, and secondary contract layouts collapse to one column. The application’s global horizontal page lock remains intact; horizontal movement is confined to the chain table.

## D. Snapshot lifecycle

### Schema and state model

Migration: `supabase/migrations/20260813030000_phase_8_5_1_snapshot_lifecycle.sql`

`research_snapshot_lifecycle_events` is append-only and records:

- snapshot and same-owner user ID;
- monotonic identity event order;
- `remove` or `restore` action;
- one bounded removal reason;
- optional bounded note;
- creation time.

A composite foreign key binds `(snapshot_id,user_id)` to the original snapshot owner. Original `research_snapshots` rows remain unchanged and retain no browser UPDATE/DELETE grant.

### Removal and restoration

Owner actions call atomic `remove_research_snapshot` and `restore_research_snapshot` RPCs. Both require an authenticated, approved, active account and same-owner snapshot. A transaction advisory lock serializes changes per snapshot. Repeating the current desired state is idempotent. Restore with no prior removal fails closed.

Removal reasons are Test snapshot, Data-entry error, Wrong expiration, Duplicate, Wrong ticker, Bad source data, and Other, with an optional note. UI terminology is consistently **Remove Snapshot**, **Removed Snapshots**, and **Restore**—never delete or edit.

### Stale-client behavior

The latest state is determined by monotonic event order, not client timestamps. Workspace loading resolves lifecycle state from the server each refresh. A stale client cannot mutate the original row or generically save over it; restoration requires the explicit restore RPC.

### Central analytical exclusion

`partitionResearchSnapshots()` runs once during workspace load and returns active and removed collections. Every existing analytics consumer reads the active collection:

- Catalyst Intelligence history;
- T-5/T-3/T-1/T0/T+1/T+5 counts;
- IV history, rank, and percentile;
- calibration sample and error statistics;
- pre-event drift;
- sample-based quality;
- Research Ledger active list;
- Markdown snapshot export.

Removed entries appear only in the recoverable **Removed Snapshots** disclosure until restored.

## E. Migration and rollback considerations

New, unapplied file only:

- `20260813030000_phase_8_5_1_snapshot_lifecycle.sql`

No deployed migration was edited. Existing observations need no rewrite. Migration application is transactional. A deliberate rollback after application would revoke/drop the two RPCs, drop the lifecycle table (after preserving lifecycle audit data if needed), then drop `research_snapshots_id_user_unique`. Rolling back would reactivate every original snapshot in old clients because suppression metadata would no longer exist; therefore rollback is an operational decision, not an automatic UI action.

Production impact is additive: one small event table, one justified owner/snapshot/order index, one composite unique owner key, and two bounded RPCs. Provider cache schema and rows are untouched.

## F. Analytics locations audited

- `app/src/data/workspace.ts`: fetches lifecycle events, partitions once.
- `app/src/components/CatalystIntelligence.tsx`: consumes active workspace snapshots for IV, timeline, calibration, history, and quality.
- `app/src/components/ResearchLedger.tsx`: active records and removed recovery are separate.
- `app/src/features/export/markdown.ts`: already consumes the active workspace collection, so removed records are excluded without another scattered filter.

Repository search found no other frontend analytics source bypassing `workspace.researchSnapshots`.

## G. Validation evidence

Executed from `app/` against implementation HEAD:

| Check | Result |
|---|---|
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm run test` | 46 files passed; 193 tests passed |
| `npm run build` | Passed; 1,678 modules transformed |
| `npm run privacy:check` | Passed |
| `npm run copy:check` | Passed |
| `npm audit --audit-level=high` | Passed; 0 vulnerabilities |
| `git diff --check` | Passed |

The existing Vite advisory remains: the main JavaScript chunk is above 500 kB. This pre-existing optimization warning does not fail the build and is not part of Phase 8.5.1.

New automated coverage includes:

- paired strike grouping and unsorted inputs;
- deterministic nearest ATM and same-strike straddle calculation;
- missing underlying/call/put, call-only, put-only, zero quotes, missing IV/Greeks;
- malformed stored data and snake-case compatibility;
- duplicate resolution;
- synthetic 12-contract WMT delayed-provider fixture;
- structured reader, freshness, observed/fetched times, cache language, secondary details, and technical disclosure;
- manual/provider differentiation;
- active/removed/restored analytics counts;
- lifecycle error copy and removed recovery presentation.

SQL files authored for trusted Supabase test execution:

- `supabase/tests/phase-8-5-1-snapshot-lifecycle-structure.sql`
- `supabase/tests/phase-8-5-1-snapshot-lifecycle-two-user-rls.sql`

They validate grants, RLS, locked search paths, immutable originals, idempotent owner removal/restore, and cross-user rejection. They were not executed locally because this environment has no Supabase CLI, Postgres client, Docker daemon, or local database. The production migration was not applied from this branch.

## H. Security and privacy

- Lifecycle SELECT is owner-only under RLS and requires approved active status.
- Browser roles have no direct lifecycle INSERT/UPDATE/DELETE.
- Browser roles retain no original snapshot UPDATE/DELETE.
- Security-definer RPCs use an empty locked search path, explicit ownership checks, bounded inputs, and per-snapshot serialization.
- Anonymous users cannot read lifecycle metadata or execute RPCs.
- Synthetic tests contain no user research, credentials, or brokerage data.
- Technical Details receives only normalized stored user-safe values.
- The service-only provider cache remains inaccessible to browser roles and is neither deleted nor changed by snapshot removal.
- No Robinhood or other brokerage credential/access path was added or used.

## I. Render and visual QA status

Automated component markup coverage passed, including a 12-contract paired chain and mobile-safe structure. Live rendered screenshots were not available in this run: the sandbox rejected local Vite binding with `listen EPERM`, and the required in-app browser audit returned zero connected browser backends. No unrelated browser tool was substituted.

Production visual acceptance is therefore required at:

- 1440×900
- 1280×800
- 768×1024
- 430×932
- 390×844
- 375×667
- 320×568

At every width confirm the page itself has no horizontal drift, primary text remains readable, and only the option-chain container scrolls horizontally on narrow screens.

## J. Deployment steps

1. Restore GitHub CLI authentication for `dkyaya` if it is still invalid.
2. Push `feature/phase-8-5-1-intelligence-usability` and open the named draft PR.
3. Review the three implementation commits and CI. Do not merge until approved by the user.
4. Merge through GitHub only when the user chooses.
5. Wait for the Pages workflow from `main` to succeed.
6. Manually run **Deploy OJ Supabase** from `main`.
7. Confirm its migration preview shows only `20260813030000_phase_8_5_1_snapshot_lifecycle.sql`, then confirm application and final migration ledger succeed.
8. Hard refresh OJ after both workflows finish.
9. Perform the production checklist below before using removal for important records.

The user remains final merge and deployment authority.

## K. Exact production acceptance checklist

1. Open the WMT catalyst War Room and select **Intelligence**.
2. Enter WMT, expiration 2026-08-21, and 6 nearby strikes.
3. Load delayed options once. Confirm the preview says either **New provider response cached** or **Private cache hit**, never both.
4. Repeat the identical request. Confirm **Private cache hit** and no additional fresh MarketData request is needed.
5. Confirm 12 contracts pair calls and puts by strike with Bid/Ask/Mid/IV visible.
6. Confirm **Delayed**, observed time, fetched time, provider, underlying, expiration, and contract count are visible.
7. Confirm nearest ATM is outlined/labeled and its same-strike call/put produces the transparent dollar/percent straddle summary.
8. Expand **Contract Details** and confirm symbol, last, volume, open interest, and available Greeks.
9. Expand **Technical Details** and confirm readable pretty JSON; collapse it and confirm no raw JSON wall remains.
10. Save the provider snapshot. Confirm the Research Ledger card remains structured and immutable.
11. If a matching manual WMT/2026-08-21 snapshot exists, confirm the comparison shows both timestamps, sources, and freshness.
12. Choose **Remove Snapshot**, select **Test snapshot**, optionally add a note, and confirm.
13. Confirm it immediately leaves active history, timeline counts, IV context, calibration `n`, and active export.
14. Open **Removed Snapshots** and confirm ticker/type/provider/observation/removal time/reason.
15. Load the identical provider request again and confirm **Private cache hit**, proving Research Ledger removal did not clear provider cache.
16. Choose **Restore**. Confirm the exact original observation returns without a clone or changed timestamp.
17. Repeat items 5–16 at all seven viewport sizes listed in Section I; use the narrow table’s internal horizontal scroll.
18. In a second approved account, confirm the owner’s removed metadata is invisible and owner snapshots cannot be removed/restored.

## L. Branch, commits, and PR

Commits:

- `293c66cf7bf0a80d2c65e1e0eec0929d92470ef9` — Render normalized option chains cleanly
- `a66e0541a0ca8068cac3034e8c5112331bb2c6b2` — Add research snapshot removal lifecycle
- `352e7cdc91a55db692955593971f22da7126786a` — Document intelligence snapshot lifecycle

Draft PR creation is pending because `gh auth status` reports the stored `dkyaya` token is invalid. No merge, deployment, or Supabase mutation occurred.

## M. Blockers and uncertainties

- GitHub authentication must be restored before branch push and draft PR creation.
- SQL lifecycle tests are authored but require a trusted Supabase/Postgres test environment to execute.
- Rendered seven-viewport QA requires a connected browser or deployed preview.
- The provider’s delayed observation timestamps and optional fields remain source-dependent; missing data is displayed as unavailable rather than inferred.

## N. Recommended next step

Restore GitHub CLI authentication, publish this branch as a draft PR, let CI run, review the migration and UI diff, then merge and deploy Phase 8.5.1 only. Complete the exact production acceptance checklist before selecting a later phase.

STOP — Phase 8.5.1 scope ends here.
