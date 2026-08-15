# OJ Work Relay — Phase 9.1 Interactive Guided Workflow

Date: 2026-08-15  
Repository: `dkyaya/OJ`  
Branch: `feature/phase-9-1-guided-workflow`  
Draft PR: [#25 — Add OJ’s adaptive guided product tour](https://github.com/dkyaya/OJ/pull/25)

## A. Baseline

- Latest `main` and Phase 9.1 branch point: `5d96de6d188e07553f3cbdbd546a7fd82e177891` (`PR #24 — Add OJ’s adaptive product tour`).
- Prior Phase 9 branch head inspected: `2b055c4f86f4ac9821dd9c525a7a93e6222f47f6` on `feature/phase-9-product-tour`.
- PR #24 was already **MERGED** on 2026-08-15 at `5d96de6`; it could no longer carry this refinement. The relay therefore authorized a new Phase 9.1 branch and PR.
- Phase 9.1 implementation/documentation head before relay packaging: `e842aa1c78344779ac07683f5607d39478345dcf`.
- No Supabase migration was added. No private journal repository change was required.

## B. Live-review feedback

1. **The Ideas portion needed a real internal workflow.** Added a hands-on Tutorial Idea with Setup, originating Catalyst, Research, thesis/evidence/conditions/invalidation/planned-exit fields, and a gated save.
2. **Catalyst, Catalyst Intelligence, and Record Trade also needed hands-on treatment.** Added interactive Tutorial Catalyst creation, synthetic options Intelligence/Scenario Lab/Ledger, Candidate economics, manual Trade recording, monitoring, Exit, Debrief, and Insights context.
3. **The Settings replay callout covered the target it explained.** Replaced the fixed placement assumption with a pure collision-aware placement engine that protects every highlighted target.
4. **Tutorial records needed to disappear reliably.** Implemented an isolated in-memory Tutorial Workspace. Finish, restart, exit, and sign-out clear its objects; pause stores only stage/status and reconstructs deterministic prerequisites on resume.

## C. Architecture

### Quick Tour

The existing 11-step, read-only Product Tour remains separate. It changes routes, highlights semantic `data-tour-id` targets, and persists only version/status/step. No synthetic form action is required.

### Guided Walkthrough

`GuidedWalkthrough.tsx` orchestrates nine action-oriented stages. Each stage uses OJ's established form styling and relevant shared primitives. The Intelligence stage reuses the production `OptionChainSnapshot`; expected-move, scenario, payoff, and P/L results use production utilities rather than duplicate calculations.

### Tutorial Workspace

`tutorial-workspace.ts` is a lightweight, typed, in-memory state model for the tutorial Catalyst, Intelligence review, Idea, Candidate, Trade, Check-In, Exit, and Debrief. It does not extend or impersonate the production `Workspace`. Demo mode remains a whole-product synthetic preview; Guided Tutorial is a temporary learning session inside an authenticated account.

### Fixture design

`tutorial-fixtures.ts` contains one coherent non-real story: `OJ Tutorial Co. (OJDEMO)`, a relative-date earnings event, and six call/put contracts at strikes 95/100/105. It is always labeled `Tutorial Fixture`, `Synthetic`, and `Tutorial session`.

### Preferences

Only `application_preferences.data.guidedWalkthrough` stores `version`, `status`, `stage`, and `updatedAt`. No option chain, form text, market data, domain record, risk value, or account data is serialized. Existing preference JSON and Quick Tour state are preserved.

## D. Hands-on flow

1. **Catalyst:** create `OJ Tutorial Co. Q2 Earnings` with synthetic prefilled ticker, category, date, time, and private Tutorial visibility.
2. **Catalyst Intelligence:** inspect $100 underlying, ATM pricing/IV, straddle and volatility move estimates, the 95/100/105 chain, provenance/freshness, one editable Scenario Lab assumption, and a Tutorial Research Ledger card.
3. **Idea:** navigate Setup → Catalyst → Research and save a bullish earnings thesis while learning fact vs interpretation.
4. **Candidate:** save the 100/105 bull call at $1.40 for one contract. Production math derives width $5, max loss $140, max profit $360, and breakeven $101.40.
5. **Record Trade:** confirm the simulated manual $1.32 fill. The screen visually preserves planned $1.40 beside actual $1.32 and derives $132 max loss, $368 max profit, and $101.32 breakeven.
6. **Check-In:** save `Thesis Intact` with a short monitoring note; the UI distinguishes live monitoring from Journal/Debrief.
7. **Exit:** record a $2.10 spread credit. Production lifecycle math derives `+$78` before fees.
8. **Debrief:** save one lightweight lesson with plan/execution/monitoring/outcome context.
9. **Insights:** show the tutorial-safe class, thesis health, plan/fill, result, and Catalyst category while explicitly excluding the object from real analytics.

## E. Data safety

- The Tutorial modules and Guided component have no import of Supabase, production data actions, collaboration actions, MarketData/provider loaders, or `fetch`.
- Tutorial actions cannot call canonical Catalyst, Idea, Candidate, Trade, Check-In, Exit, Debrief, snapshot, forecast, evidence, mission, or workspace mutations.
- Opening Tutorial Intelligence performs zero network/provider/cache activity and consumes no provider credit.
- OJ never routes or submits an order. The tutorial simulates only the manual post-broker recording step.
- Tutorial $132 risk never enters Overview/risk capacity/exposure; it does not subtract from the user's policy ceiling.
- Tutorial Check-In and Debrief never enter Journal; objects never enter Insights, calibration, histories, Research Ledger analytics, forecasts, collaboration/activity, or exports.
- Component and state tests compare the real demo Workspace before/after the complete reconstructed tutorial and assert it is unchanged.
- Finish/restart/exit/sign-out clear memory. Pause/reload reconstructs prerequisites from bounded progress without persisting arbitrary tutorial input.

## F. Placement repair

- `placement.ts` treats the highlighted DOM bounds as a protected rectangle.
- It evaluates below, above, right, and left placements inside viewport safe margins and with a 14px target gap.
- When an anchored card cannot fit, it selects a detached top/bottom position. If necessary, it reduces the scrollable card height to the collision-free viewport region rather than covering the target.
- A bottom-navigation target on mobile prefers an above or detached-top card.
- Target/card geometry is recomputed after route render, nested/document scroll, resize, orientation change, and card `ResizeObserver` changes.
- The Settings replay geometry and mobile bottom-navigation geometry have explicit deterministic tests.

## G. Accessibility

- Phase 9 editable-control protection remains: input, textarea, select, contenteditable, and text-entry roles keep native Left/Right behavior.
- Meta, Ctrl, and Alt arrow shortcuts are not intercepted.
- Escape pauses each active experience.
- Quick and Guided actions use synchronous refs to serialize buttons and keyboard transitions before React can rerender.
- Guided failure tests prove the lock releases after a rejected save and retry remains possible.
- Focus moves to the current Quick card or Guided heading; the Guided surface remains non-modal.
- First-use selection remains the only modal focus-managed dialog.
- Reduced-motion rules remove optional Tour animation and existing scrolling logic respects the media preference.

## H. Files changed

Twenty-two source/documentation files changed before relay packaging. See `FILES_CHANGED.md` for the exact list and purpose.

## I. Tests

Final local full suite: **58 test files, 266 tests, all passed**.

GitHub Actions run `31913400832` on implementation head `e842aa1` also passed all four jobs: **OJ Public Validate, OJ Public Test, OJ Public Build, and OJ Public Security**.

New/expanded coverage includes:

- complete Catalyst-to-Insights synthetic component flow;
- exact planned/actual spread economics and +$78 P/L;
- finish cleanup and deterministic resume/clear behavior;
- no-write/no-provider import boundary and zero `fetch` calls;
- real risk/Journal/Insights/calibration/collaboration/export state unchanged;
- Guided action gating, editable arrows, Escape pause, serialization, and failure unlock;
- first-use mode presentation and Settings replay;
- nine placement geometry cases, including Settings, mobile bottom navigation, and detached fallback;
- all prior Quick Tour keyboard, target, empty-account, mobile-navigation, and missing-target behavior.

Exact commands/results are in `VALIDATION.md`.

## J. Build and security

- TypeScript: passed.
- ESLint: passed with zero warnings.
- Production Vite build: passed.
- UI copy check: passed.
- public privacy check: passed.
- high-level npm audit: zero vulnerabilities.
- `git diff --check`: passed.
- Existing warning remains: the production JS chunk is 790.79 kB minified (213.20 kB gzip), above Vite's 500 kB advisory. This Phase 9.1 work does not expand scope into app-wide code splitting.
- No migration or database workflow is required.

## K. Browser QA

No live branch rendering is claimed. The Work sandbox rejected local Vite listener creation with `listen EPERM: operation not permitted 127.0.0.1:5173`. Component rendering, jsdom interaction tests, CSS/static review, pure responsive geometry, and the production build completed. The exact post-deploy eight-viewport matrix is in `PRODUCTION_ACCEPTANCE.md`.

## L. Production acceptance

`PRODUCTION_ACCEPTANCE.md` contains the exact Quick Tour, Guided Walkthrough, target-occlusion, cleanup, data-safety, and 1440×900 through 320×568 responsive checks. It should be completed after an owner-approved deployment.

## M. Git

- Branch: `feature/phase-9-1-guided-workflow`
- Draft PR: #25, open and mergeable at creation. Implementation CI run `31913400832` is green across all four required jobs.
- PR #24: merged; no longer usable for additional Phase 9.1 commits.
- Commits before relay packaging:
  - `47529ba` — Introduce isolated Guided Tutorial workspace
  - `e34d2fb` — Add interactive Guided Walkthrough and safe tour placement
  - `e842aa1` — Document Phase 9.1 onboarding boundaries
- Patch series is included under `patches/`.
- Keep the PR draft until production acceptance is reviewed. Do not auto-merge; the owner remains final merge authority.

## N. Blockers and uncertainties

- Live visual QA is the only environment blocker; local port binding is prohibited.
- The existing bundle-size advisory remains and is not a functional failure.
- Product copy/interaction should receive the requested owner visual pass at all eight viewport sizes before merge.
- No Supabase, provider, broker, private-repository, or secret blocker exists for this phase.

## O. Recommendation

Phase 9.1 is implementation-complete, locally validated, and green in implementation CI. Treat Phase 9 as complete only after the owner completes the production acceptance matrix, especially the full Guided story and target-occlusion checks on mobile and Settings. If those checks pass, OJ is ready to plan Phase 10 Contextual Guidance in a separate scope.

**STOP. Do not begin Phase 10. Do not merge without owner approval.**
