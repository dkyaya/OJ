# OJ Phase 8.6 — Live-Use Production Refinement

Date: 2026-08-13  
Repository: `dkyaya/OJ`  
Branch: `feature/phase-8-6-live-use-refinement`  
Recommended PR title: **Refine OJ’s research-to-trade workflow**

## A. Baseline

- Starting `main`: `f8d4f73f8aaf7e3d5b124345b75c5f66ac576b06` (merged PR #21, Phase 8.5.1).
- Production Supabase migration ledger was current through `20260813030000_phase_8_5_1_snapshot_lifecycle`; its deploy workflow completed successfully.
- Production contained the expected existing lifecycle tables and owner RLS. Aggregate inspection found existing Ideas, Candidates, Trades, entries, and reviews but no Check-Ins or Exits. No private research text was copied into this repository or relay.
- Production account policy already stores the user’s deliberate `$800` maximum-open-options-risk ceiling. No private policy mutation was performed.
- Architecture inspected: Ideas/Candidates, Trades and legacy entry processor, Check-Ins/Exits, Journal, Forecasts, Catalyst Intelligence/Research Ledger, Markdown export, RLS, account policy, CI, and GitHub Pages/Supabase workflows.

## B. Live-use friction audit

Before Phase 8.6, Trade entry retained an Idea link but required the user to re-enter much of execution context. The form did not cleanly retain Candidate ID/revision, expiration, strikes, planned-versus-actual economics, trade intention, research snapshot/Forecast references, or a complete entry thesis snapshot. Monitoring had stored tables but no coherent user-facing Check-In or Exit workflow. The Trade page did not keep original thesis, current management view, relevant Catalysts, and Research Ledger provenance together. Journal review creation did not start from a closed Trade and required manual story reconstruction.

High-value fixes were intentionally confined to this lifecycle. The Calendar, War Room, navigation system, provider cache, workspace collaboration, and broader visual language were reused.

## C. Architecture decisions

Reused:

- canonical `trade_ideas`, `trade_candidates`, `trades`, `trade_entries`, `trade_checkins`, `trade_exits`, `journal_reviews`, `account_policies`, `research_snapshots`, `personal_forecasts`, and Catalyst link tables;
- existing payoff utilities, account-policy Settings, exposure tags, Idea trade-backed protections, Research Ledger, Forecasts, and Obsidian export;
- Supabase owner RLS and approved-account model.

Changed:

- added a narrow versioned entry-context snapshot and typed execution fields;
- added public security-invoker lifecycle functions backed by private locked-search-path implementations;
- changed Trade history tables to browser read-only with validated lifecycle writes;
- added one insert-only RLS exit command table so Exit creation and Trade closure are atomic;
- added concise user-authored Thesis Health, management revisions, and full Exit semantics;
- linked Debriefs to closed Trades and expanded portable Markdown output.

Deliberately not built: brokerage connectivity/imports, order routing, automatic recommendation or sizing, live P/L, partial-lot accounting, Greeks/optimizer/correlation modeling, notifications, P09 Tour, P10 guidance framework, or P11 broker tooling.

## D. Research → Trade implementation

- Qualified Watchlist/Ready Ideas expose **Record Trade**.
- The Trade form prepopulates Idea, Candidate, ticker/setup, Candidate expiration/strikes/debit/contracts, originating Catalyst, Idea revision, and Candidate revision.
- Actual expiration, strikes, contracts, debit, fees, and fill time remain explicitly editable and are displayed beside the unchanged planned Candidate.
- Width, actual maximum loss/profit, break-even, and reward/risk are derived. Debit verticals require correct strike orientation and `0 < debit < width`; expiration cannot precede entry.
- Entry is confirmed as an actual fill executed outside OJ. OJ cannot place or alter an order.
- `entry_context.version = 1` captures the entry-time Idea thesis/plan, Candidate, actual execution, Catalyst cluster and links, up to six pre-entry Research Snapshot IDs, up to three locked Forecast IDs, exposure tags, and risk-policy context.
- Later Idea edits remain visible as the current linked Idea but cannot rewrite entry context, Candidate provenance, or actual execution.

## E. Risk framework

- Ceiling comes from `account_policies.maximum_open_options_risk`; tests use a non-$800 policy to prove it is not hard-coded.
- Open debit-vertical risk is actual debit × 100 × open contracts. Closed Trades are excluded.
- Overview, Trades, and Record Trade show open maximum loss, ceiling, and remaining capacity.
- Copy explicitly says this is an OJ risk-policy rule and **not brokerage buying power, cash, or margin**.
- Exposure tags show informational shared context. They do not double-count total risk or claim measured correlation.
- A confirmed historical fill may exceed policy only after explicit acknowledgement and explanation. OJ records it; it does not resize, reject, route, or cancel it.

## F. Trade monitoring

- Trade detail now keeps actual structure, entry thesis/invalidation/planned exit, original Candidate, actual execution, latest Thesis Health, entry Research Snapshot/Forecast references, upcoming linked Catalysts, and append-only history together.
- Thesis Health is user-controlled: Stronger, Intact, Weaker, or Invalidated.
- Concise Check-Ins capture what changed, price/Catalyst/IV/macro flags, invalidation state, planned-exit state, and an optional current management view.
- Original entry plan and later management view remain separate. Invalidated Thesis Health never closes a Trade automatically.
- Check-In selection locks the Trade row to prevent a concurrent Exit from producing an observation after closure.

## G. Exit and Debrief

- Full Exit records timestamp, closing debit/credit, fees, user-selected reason, Thesis Health at Exit, Catalyst relationship, notes, realized P/L, and contracts exited.
- Exit and Trade closure happen atomically; closed risk immediately leaves the open-risk total after refresh.
- Phase 8.6 intentionally supports one full closing transaction, not multi-lot or partial-exit accounting.
- **Record Exit & Debrief** opens Journal with the closed Trade selected.
- Debrief automatically assembles Facts, Original Plan, Evolution, Outcome, entry Candidate, Check-Ins, and research-reference count. Reflection remains user-authored.

## H. Schema and migration

Apply exactly one new migration after the existing Phase 8.5.1 migration:

`supabase/migrations/20260813201443_phase_8_6_research_to_trade_lifecycle.sql`

It is additive and leaves legacy Trade rows valid through nullable typed fields. It adds typed lifecycle columns, owner-bound Candidate/Catalyst/Journal foreign keys, indexes, constraints, a versioned context, Trade classification, structured Check-In/Exit fields, an insert-only exit command, and lifecycle functions/triggers.

RPC/API surface:

- `public.record_trade_entry_v2(...)`
- `public.record_trade_checkin(...)`
- `public.record_trade_exit(...)`
- private entry and Check-In implementations plus private Trade-history/Exit triggers

Rollback must be a reviewed follow-up migration. Do not rename or delete an applied migration. A rollback should first restore the previous app release, then restore required grants/functions before removing new constraints or columns. Dropping context/Exit data is destructive and is not recommended.

## I. Security

- Ideas, Trades, fill values, entry context, risk, Check-Ins, Exits, Journal, and Forecasts remain owner-only.
- Anonymous roles receive no lifecycle access.
- Authenticated browsers can read owner rows through RLS but cannot directly insert/update/delete Trade, entry, Check-In, or Exit history.
- Private implementations verify `auth.uid()`, approved-account state, ownership, eligible Idea state, Candidate ownership, structure, confirmation, and policy acknowledgement.
- Exit commands have owner insert RLS and an owner-bound composite Trade foreign key. The private trigger validates the active Trade before writing immutable Exit history.
- Synthetic two-user SQL proves User B cannot see or mutate User A’s Trade or Check-In and User A can complete the lifecycle inside a rolled-back transaction.
- No brokerage or Robinhood credentials were accessed or introduced.

## J. UI and UX

- Desktop: four risk metrics, clear planned/actual comparison, three-part Trade detail, research/Catalyst continuity, and compact monitoring/history.
- Tablet/mobile: lifecycle grids collapse from 3/2 columns to one, risk metrics collapse to two then one, form controls remain 16px/44px touch-safe, action/footer controls stack, and all new cards use `minmax(0,1fr)`, `min-width:0`, and wrapping to prevent horizontal page scroll.
- The existing liquid mobile navigation and motion system are unchanged.
- Rendered QA limitation: the sandbox rejected local port binding (`EPERM`) and browser security correctly blocked direct `file://` navigation. The changed build therefore was not visually rendered in this run. Responsive behavior was checked by source/CSS inspection and SSR presentation tests only; the exact post-deploy breakpoint checklist is included below.

## K. Testing

Latest successful application gate:

- `npm run typecheck` — pass
- `npm run lint` — pass, zero warnings
- `npm test -- --run` — **49 files, 218 tests passed**
- `npm run build` — pass; 1,679 modules transformed
- `npm run copy:check` — pass
- `npm run privacy:check` — pass
- `git diff --check` — pass
- `npm audit fix` updated transitive `nanoid` from 3.3.17 to patched 3.3.18 and returned **0 vulnerabilities**. A later repeat could not reach the npm audit endpoint due environment DNS; the patched installed and locked version was verified locally.

Build warning: the main JavaScript chunk is about 737 kB minified / 199 kB gzip and exceeds Vite’s 500 kB advisory threshold. This pre-existing performance warning is not a functional failure and should be handled through future route-level code splitting rather than mixed into lifecycle work.

SQL checks authored:

- `supabase/tests/phase-8-6-research-to-trade-structure.sql`
- `supabase/tests/phase-8-6-research-to-trade-two-user-rls.sql`

They were statically reviewed but not executed locally: no Supabase CLI/Postgres runtime was installed, registry access was unavailable, and the production project has no development branch. Do not run synthetic acceptance SQL against production. The deploy workflow and post-deploy trusted SQL session remain required.

## L. Deployment

1. Push the feature branch and open a draft PR.
2. Let OJ CI run lint, typecheck, tests, build, copy/privacy checks, and audit.
3. Review the migration and synthetic SQL before merge.
4. Merge only with user approval.
5. Run the manual Supabase deploy workflow. It must apply `20260813201443_phase_8_6_research_to_trade_lifecycle` after all earlier migrations.
6. Run the two Phase 8.6 SQL checks through a trusted non-production test branch/session. If no branch is available, run only the structural test after deployment and execute the rolled-back two-user test in a deliberately provisioned safe test environment.
7. Confirm Supabase advisors and migration ledger.
8. Let Pages deploy the matching frontend only after the database migration succeeds; otherwise new actions show a clear database-update message.
9. No production policy update is needed: the current stored ceiling is already `$800`.

## M. Exact production acceptance checklist

- [ ] At 1440×900 and 1280×800, open a complete Watchlist/Ready Idea and choose **Record Trade**.
- [ ] Confirm Idea, Candidate, setup, originating Catalyst, expiration, strikes, contracts, planned debit, and provenance prepopulate.
- [ ] Enter a synthetic actual debit different from planned and confirm derived economics change while planned values do not.
- [ ] Confirm the actual-fill-outside-OJ statement and record the synthetic Trade.
- [ ] Confirm the Candidate remains unchanged and Trade shows both planned and actual values.
- [ ] Edit the linked Idea thesis; confirm Trade still shows the original Entry Thesis and separately notes the current Idea changed.
- [ ] Save a Check-In with Thesis Health and a changed management view; confirm it appears historically and the original plan remains unchanged.
- [ ] Confirm relevant upcoming Catalysts and entry Research Snapshot/locked Forecast references appear.
- [ ] Confirm Overview/Trades open max loss and remaining capacity update under the stored `$800` ceiling.
- [ ] Confirm exposure tags do not change the open-risk total.
- [ ] Record a full synthetic Exit and verify realized P/L, reason, Thesis Health, closed state, and lower open risk.
- [ ] Confirm Journal opens with that Trade selected and shows Facts, Original Plan, Evolution, Outcome, and blank user reflection fields.
- [ ] Export the journal; inspect planned/actual, entry thesis, Check-Ins, Exit, Catalyst references, and reflection Markdown.
- [ ] Repeat Record Trade, Trade detail, Check-In, Exit, and Debrief review at 1024×768, 768×1024, 430×932, 390×844, 375×667, and 320×568.
- [ ] At every size, confirm no horizontal page scroll, no clipped actions, readable labels, 44px touch targets, and usable mobile navigation.
- [ ] Confirm User B cannot see User A’s Trade, fill, risk, entry context, Check-Ins, Exit, or Debrief.
- [ ] Do not validate with real open Trades unless the user deliberately chooses to do so.

## N. Git

Local commits:

- `b44831e` — Refine the research-to-trade lifecycle
- `c8d9254` — Protect immutable trade lifecycle history
- `f84c467` — Document Phase 8.6 lifecycle semantics
- `8e00c55` — Harden lifecycle concurrency checks

Diff from starting main: 32 files, 1,229 insertions, 69 deletions before adding this relay package.

Remote publishing is the only incomplete Git step. The GitHub CLI reports an invalid `dkyaya` token, the terminal cannot currently resolve `github.com`, and the connected GitHub integration can read the repository but cannot create Git trees. No remote branch or PR was fabricated. After CLI authentication/network is restored:

```text
git push -u origin feature/phase-8-6-live-use-refinement
gh pr create --draft --base main --head feature/phase-8-6-live-use-refinement --title "Refine OJ’s research-to-trade workflow" --body-file relays/oj-phase-8-6-live-use-refinement-relay-2026-08-13/PR_BODY.md
```

Recommendation: keep the PR draft until CI, migration review, trusted SQL execution, and rendered breakpoint QA finish. Do not auto-merge.

## O. Blockers and uncertainties

- Remote branch/PR creation is blocked by GitHub CLI authentication plus terminal DNS. The local branch is committed and ready.
- The new migration and synthetic SQL were not executed against Postgres in this run because no local/test database was available. Production was intentionally not used as a test environment.
- The changed frontend could not be rendered locally because the sandbox forbids port binding and direct file navigation. No rendered-QA claim is made.
- Phase 8.6 supports full exits only. Existing legacy Trades remain readable but cannot retroactively acquire a complete entry-context snapshot without an explicit future correction/migration design.
- Route-level code splitting remains a bounded performance follow-up.

## P. Recommended next phase

Do **not** begin P09 yet. First complete the draft PR, trusted migration/RLS execution, deployment, and the exact responsive acceptance checklist using synthetic data. If those pass without another live-use friction issue, OJ is ready for a small P09 Tour slice that teaches the now-coherent lifecycle. If entry, Check-In, Exit, or mobile rendering exposes one concrete defect, make one small Phase 8.6.x repair before P09.

STOP: no P09, P10, P11, ML, or brokerage work is included.
