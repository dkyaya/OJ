## Summary

- preserves the concise, read-only Quick Tour and isolated OJDEMO Tutorial Workspace
- refactors the Guided Walkthrough to use the same Catalyst, Catalyst Intelligence, Idea/Candidate, Record Trade, Check-In, Exit, Debrief, Trade detail, and Insights surfaces used in normal OJ
- keeps production Supabase/provider actions in production wrappers and supplies only in-memory fixture actions in Tutorial mode
- adds truthful synthetic confirmations through narrow shared-editor presentation adapters while preserving exact production fill/exit attestations
- makes both enabled Tutorial Intelligence save paths persist one session-only snapshot instead of reporting success through a no-op
- removes the placement engine’s least-overlap fallback: a returned callout can never cover its protected target
- adds reduced-height scrollable placement and one protected-space scroll/remeasure attempt for constrained viewports

## Safety boundaries

- no canonical Catalyst, Idea, Candidate, Trade, Check-In, Exit, Debrief, forecast, snapshot, or activity rows
- zero provider requests and zero provider-cache writes in the Guided story
- Tutorial snapshot history exists only after an in-memory save and clears with the Tutorial
- no brokerage connection, credentials, order submission, or order routing
- no effect on real risk, Journal, Insights, calibration, collaboration, activity, or exports
- preferences store only versioned onboarding status/progress
- no Supabase migration

## Architectural regression coverage

- production and Guided Catalyst flows behaviorally render the shared `CatalystEditor`
- Guided full-story assertions identify the shared Intelligence, Idea, Candidate, Record Trade, Trade detail, Check-In, Debrief, and Insights layers
- production Ideas/Trades/Journal tests identify the same shared layers
- structural boundary covers Tutorial state, fixture, adapter, and orchestrator imports
- behavioral coverage proves production manual/provider saves and copy, Tutorial pre/post-save history, disabled provider fetches, zero provider traffic, cleanup, and truthful fill/exit language
- 13 placement cases cover Settings, bottom navigation, 390/375/320 mobile widths, a 320×568 large-target reduced-height case, and impossible geometry

## Validation

- `npm run typecheck` — passed
- `npm run lint` — passed with zero warnings
- `npm test` — 60 files / 276 tests passed
- `npm run build` — passed; 1,694 modules; existing >500 kB chunk warning remains
- `npm run copy:check` — passed
- `npm run privacy:check` — passed
- `npm audit --audit-level=high` — 0 vulnerabilities
- `git diff --check` — passed
- GitHub Actions run 31915193435 — all four jobs passed

## Browser limitation

The Work sandbox still rejects local Vite listener creation with `listen EPERM: operation not permitted 127.0.0.1:5173`. No live visual claim is made. The relay contains the exact eight-viewport post-deploy acceptance matrix.

## Scope

Phase 9.1 only. No Phase 10 work. Keep this PR draft and unmerged until owner review.
