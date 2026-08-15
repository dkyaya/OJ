# OJ Work Relay — Phase 9.1 Interactive Guided Workflow

Date: 2026-08-15

Repository: `dkyaya/OJ`

Branch: `feature/phase-9-1-guided-workflow`

Draft PR: [#25 — Add OJ’s adaptive guided product tour](https://github.com/dkyaya/OJ/pull/25)

## Status

The Phase 9.1 review addendum is implemented. The original isolated Tutorial Workspace, OJDEMO fixture, bounded preferences, deterministic reconstruction/cleanup, no-write/provider boundary, and nine-stage story remain intact. The Guided Walkthrough no longer owns substitute versions of OJ’s major forms, and the Quick Tour no longer has an intentional-overlap fallback.

- Base/main: `5d96de6d188e07553f3cbdbd546a7fd82e177891`
- Addendum implementation head: `8311847d278ea303d94a062c2215e16e4bef2e46`
- Implementation CI: [run 31914587168](https://github.com/dkyaya/OJ/actions/runs/31914587168), all four jobs passed
- PR #25 remains draft and unmerged
- No Supabase migration, Edge Function, private-journal change, provider integration, or brokerage behavior was added

## Production UI reuse

The production-surface audit and minimal extraction plan were written first in `docs/PHASE_9_1_REAL_UI_REUSE_PLAN.md`.

The Guided Walkthrough now renders these shared production layers:

| Guided stage | Shared OJ layer | Production action owner | Tutorial action owner |
| --- | --- | --- | --- |
| Catalyst | `CatalystEditor` | `CatalystsPage` → `saveCatalystRecord` | `createTutorialCatalyst` |
| Intelligence | `CatalystIntelligence` + `OptionChainSnapshot` | `productionCatalystIntelligenceActions` | fixture-only injected actions |
| Idea Setup/Catalyst/Research | `IdeaEditorSurface` | `Workflow` draft/cloud orchestration | `saveTutorialIdea` |
| Candidate | section four of `IdeaEditorSurface` | `Workflow` | `saveTutorialCandidate` |
| Record Trade | `RecordTradeEditor` | `TradesPage` → `recordEntry` | `recordTutorialTrade` |
| Monitoring | `TradeDetailSurface` + `TradeCheckinEditor` | `TradesPage` → `saveTradeCheckin` | `addTutorialCheckin` |
| Exit | `TradeDetailSurface` + `TradeExitEditor` | `TradesPage` → `recordTradeExit` | `recordTutorialExit` |
| Debrief | `DebriefEditor` + `DebriefContext` | `JournalPage` → `saveJournalReview` | `saveTutorialDebrief` |
| Insights | `InsightsPage` | read-only real `Workspace` | read-only Tutorial-derived `Workspace` |

`GuidedWalkthrough` is now primarily an orchestrator: stage/progress, instructions, gating, labels, adapter selection, and Tutorial state. The former hand-written `CatalystStage`, `IntelligenceStage`, `IdeaStage`, `CandidateStage`, `TradeStage`, `MonitoringStage`, `ExitStage`, `DebriefStage`, and `InsightsStage` interfaces were removed.

## Adapter and data boundary

`tutorial-ui-adapter.ts` is a pure conversion boundary from `TutorialWorkspace` to the domain-shaped read models consumed by shared components. It imports types and pure utilities only.

Shared editors have no Supabase or provider imports. Production pages own canonical actions; the Guided orchestrator owns in-memory actions. Catalyst Intelligence receives an explicit action adapter:

```text
shared production UI
├── production adapter → Supabase/provider actions
└── Tutorial adapter → TutorialWorkspace + bundled option fixture
```

The Tutorial Catalyst Intelligence view explicitly displays `Tutorial Fixture`, `Synthetic`, and `No provider request made`. Provider refresh/load actions are disabled. Fixture save/review actions resolve only through the injected no-write adapter. The full Guided behavior test completes Catalyst through Insights with zero `fetch` calls, while the structural boundary test rejects imports of production actions, Supabase, collaboration actions, and production provider loaders.

## Preserved tutorial story

The coherent OJDEMO story is unchanged:

- synthetic earnings Catalyst;
- $100 underlying and six 95/100/105 call/put contracts;
- 100/105 bull call Candidate at $1.40;
- manually recorded $1.32 fill, with $132 max loss, $368 max profit, and $101.32 breakeven;
- Thesis Intact Check-In;
- $2.10 full exit and +$78 before fees;
- Debrief and read-only Insights presentation;
- finish/restart/exit/sign-out cleanup.

OJ never places an order. Tutorial objects cannot enter canonical rows, real risk, Journal, Insights, calibration, collaboration/activity, provider cache, or exports.

## Absolute target protection

`placeTourCallout` now has no least-overlap success path.

1. Try below, above, right, and left.
2. Try detached top/bottom regions.
3. Reduce the card max-height to the collision-free region; card content remains scrollable.
4. If the current scroll geometry exposes no protected region, withhold the card, scroll the target toward an edge once, and remeasure.
5. If a target leaves literally no protected viewport region, return no placement rather than cover the target.

Every returned target-aware placement is inside the safe viewport and non-overlapping. Deterministic tests cover Settings, bottom navigation, 390×844, 375×667, 320×568 with a wide/tall center target, a reduced-height detached card, and the mathematically impossible no-region case.

## Accessibility and safety retained

- input, textarea, select, contenteditable, and text-entry roles retain native arrow behavior;
- Meta/Ctrl/Alt + arrows are untouched;
- Escape pauses;
- synchronous refs serialize keyboard/button transitions and release on failure;
- current focus and reduced-motion behavior remain;
- Tutorial preferences remain bounded to version/status/stage/timestamp;
- cleanup and deterministic resume behavior remain;
- no provider traffic, canonical writes, brokerage behavior, or cross-surface contamination.

## Validation

Final local suite: **59 test files / 271 tests passed**.

- typecheck: pass
- ESLint: pass, zero warnings
- build: pass, 1,694 modules transformed
- copy check: pass
- privacy check: pass
- npm audit at high severity: pass, 0 vulnerabilities
- `git diff --check`: pass
- existing Vite advisory remains for the 783.91 kB minified JS chunk (213.10 kB gzip)

GitHub Actions run `31914587168` passed **OJ Public Validate, OJ Public Test, OJ Public Build, and OJ Public Security**. The runner emitted the existing Node-20-action deprecation annotation for `actions/checkout@v4` / `actions/setup-node@v4`; jobs ran successfully under the forced Node 24 runtime.

## Browser QA limitation

No live branch rendering is claimed. The Work sandbox still rejects the Vite listener with:

`listen EPERM: operation not permitted 127.0.0.1:5173`

The relay therefore includes the exact post-deploy eight-viewport acceptance matrix. Component/jsdom interaction tests, pure placement geometry, CSS/static review, and production build all completed.

## Relay contents

- `RELAY.md`
- `VALIDATION.md`
- `FILES_CHANGED.md`
- `PRODUCTION_ACCEPTANCE.md`
- `PR_BODY.md`
- patch series through the real-UI/no-overlap repair

## Recommendation

Keep PR #25 draft until the owner completes the production acceptance matrix, with special attention to recognition of the real production forms and target protection at 390/375/320 widths. Do not merge automatically. Do not begin Phase 10.
