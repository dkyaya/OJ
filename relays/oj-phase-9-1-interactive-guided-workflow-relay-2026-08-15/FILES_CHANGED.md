# Files Changed

Implementation delta from `5d96de6` through `e842aa1`:

- `app/src/App.tsx` — integrates first-use choice, Guided lifecycle, preference persistence, Settings actions, sign-out cleanup.
- `app/src/components/GuidedWalkthrough.tsx` — nine-stage hands-on synthetic workflow.
- `app/src/components/GuidedWalkthrough.test.tsx` — full story, network boundary, cleanup, keyboard/serialization/failure coverage.
- `app/src/components/ProductTour.tsx` — three-choice invitation and collision-aware placement integration.
- `app/src/components/ProductTour.test.tsx` — first-use copy/presentation updates.
- `app/src/components/ProductTour.keyboard.test.tsx` — invitation callback/serialization regression updates.
- `app/src/features/tour/guided-tutorial.ts` — versioned Guided status/stage helpers and labels.
- `app/src/features/tour/guided-tutorial.test.ts` — bounded preference-state coverage.
- `app/src/features/tour/placement.ts` — pure protected-target geometry engine.
- `app/src/features/tour/placement.test.ts` — desktop, mobile, Settings, viewport, and fallback geometry.
- `app/src/features/tour/product-tour.ts` — Quick Tour action label clarity.
- `app/src/features/tour/product-tour.test.ts` — Quick Tour label regression.
- `app/src/features/tour/tutorial-fixtures.ts` — OJDEMO event/story/options fixture.
- `app/src/features/tour/tutorial-workspace.ts` — isolated state/actions and production math reuse.
- `app/src/features/tour/tutorial-workspace.test.ts` — full state, exclusions, reconstruct/clear, import boundary.
- `app/src/pages/SettingsPage.tsx` — separate Quick/Guided start/resume/restart controls and preference preservation.
- `app/src/pages/SettingsPage.test.tsx` — both Settings onboarding modes.
- `app/src/styles/product-tour.css` — first-use choices, Guided layouts, responsive states, collision card variables.
- `app/tsconfig.tsbuildinfo` — tracked TypeScript build metadata refreshed for new source files.
- `docs/PRODUCT_TOUR.md` — two-mode architecture, isolation, lifecycle, placement, accessibility.
- `docs/INTERACTION_WORKFLOW.md` — Tutorial action/data boundaries and workflow semantics.
- `docs/NAVIGATION_ARCHITECTURE.md` — Quick placement and Guided shell behavior.

No Supabase migration, Edge Function, GitHub workflow, private journal, provider, or brokerage file changed.
