# Files Changed

Implementation delta from `5d96de6` through final addendum head `d4ebaf1`: 41 application/documentation files before relay packaging.

## Guided lifecycle and application integration

- `app/src/App.tsx` — first-use choice, Guided lifecycle, bounded preference persistence, Settings actions, and sign-out cleanup.
- `app/src/components/GuidedWalkthrough.tsx` — orchestration around shared production UI and Tutorial adapters; truthful synthetic trade/exit presentation; real in-memory snapshot save.
- `app/src/components/GuidedWalkthrough.test.tsx` — full real-UI Guided story, truthful copy, pre/post-save history, cleanup, provider boundary, keyboard/serialization/failure behavior.
- `app/src/components/SharedTutorialUi.test.tsx` — behavioral production/Tutorial Catalyst editor reuse regression.
- `app/src/features/tour/guided-tutorial.ts` / `.test.ts` — versioned Guided status/stage and bounded preference coverage.
- `app/src/features/tour/tutorial-fixtures.ts` — OJDEMO event and bundled options fixture.
- `app/src/features/tour/tutorial-workspace.ts` / `.test.ts` — isolated in-memory state/actions, Tutorial snapshot lifecycle, deterministic reconstruction/cleanup, production-state exclusion, no-write boundary.
- `app/src/features/tour/tutorial-ui-adapter.ts` — pure Tutorial-to-shared-UI read-model adapter; exposes a synthetic Research Snapshot only after the Tutorial save.

## Shared production editors and wrappers

- `app/src/components/editors/CatalystEditor.tsx` — controlled Catalyst editor used by production and Tutorial.
- `app/src/components/editors/IdeaEditorSurface.tsx` — controlled Setup/Catalyst/Research/Candidate editor.
- `app/src/components/editors/TradeLifecycleEditors.tsx` — shared Record Trade, Check-In, Exit, Trade detail, and risk-capacity surfaces; production-default copy with narrow Tutorial presentation injection.
- `app/src/components/editors/DebriefEditor.tsx` — shared Debrief editor and context presentation.
- `app/src/components/Workflow.tsx` — retains production draft/cloud orchestration and renders `IdeaEditorSurface`.
- `app/src/pages/CatalystsPage.tsx` — retains `saveCatalystRecord` and renders `CatalystEditor`.
- `app/src/pages/TradesPage.tsx` — retains `recordEntry` / Check-In / Exit actions and composes shared lifecycle UI.
- `app/src/pages/JournalPage.tsx` — retains `saveJournalReview` and composes shared Debrief UI.
- `app/src/pages/IdeasPage.test.tsx`, `TradesPage.test.tsx`, `JournalPage.test.tsx` — production shared-layer regressions, including exact fill/exit attestations.

## Catalyst Intelligence adapter

- `app/src/components/CatalystIntelligence.tsx` — shared presentation accepts action/fixture/persistence-copy adapters; Tutorial saves can become single-use while production defaults remain unchanged.
- `app/src/components/CatalystIntelligence.behavior.test.tsx` — real manual/provider adapter calls and exact production success-copy regressions.
- `app/src/components/CatalystIntelligence.test.tsx` — injected-action rendering regression.
- `app/src/components/CatalystWarRoom.tsx` — passes the production Intelligence action adapter.
- `app/src/data/catalyst-intelligence-actions.ts` — explicit production Supabase/provider boundary.

## Product Tour target protection

- `app/src/components/ProductTour.tsx` — integrates collision-free placement, protected-space scroll retry, and withholds impossible placements.
- `app/src/features/tour/placement.ts` — removes least-overlap fallback and returns only protected placements.
- `app/src/features/tour/placement.test.ts` — 13 geometry cases including 390/375/320 and impossible geometry.
- `app/src/components/ProductTour.test.tsx`, `ProductTour.keyboard.test.tsx` — invitation/presentation and keyboard safety from Phase 9.1 baseline.
- `app/src/features/tour/product-tour.ts` / `.test.ts` — Quick Tour action label behavior from baseline.

## Settings, styling, metadata, and documentation

- `app/src/pages/SettingsPage.tsx` / `.test.tsx` — separate Quick/Guided controls from baseline.
- `app/src/styles/product-tour.css` — invitation, shared-real-UI Guided composition, responsive states, and collision card max-height.
- `app/tsconfig.tsbuildinfo` — tracked TypeScript build metadata refreshed.
- `docs/PHASE_9_1_REAL_UI_REUSE_PLAN.md` — production surface audit and extraction plan written before refactor.
- `docs/PRODUCT_TOUR.md` — Phase 9.1 architecture and lifecycle documentation.
- `docs/INTERACTION_WORKFLOW.md` — Tutorial action/data boundaries.
- `docs/NAVIGATION_ARCHITECTURE.md` — Quick placement and Guided shell behavior.

No Supabase migration, Edge Function, GitHub workflow, private journal, provider implementation, or brokerage file changed.
