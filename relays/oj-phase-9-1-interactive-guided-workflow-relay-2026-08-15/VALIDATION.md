# Phase 9.1 Validation

Validated from `feature/phase-9-1-guided-workflow` at final addendum implementation head `d4ebaf11754c49af6f22448cc06c5fde23a864a3` on 2026-08-15.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | Pass, 60 files / 276 tests |
| `npm run build` | Pass, 1,694 modules transformed |
| `npm run copy:check` | Pass |
| `npm run privacy:check` | Pass |
| `npm audit --audit-level=high` | Pass, 0 vulnerabilities |
| `git diff --check` | Pass |

## Build output

- `dist/index.html`: 0.60 kB; 0.37 kB gzip
- CSS: 88.59 kB; 15.80 kB gzip
- JS: 786.85 kB; 213.85 kB gzip
- Advisory: Vite reports the existing JS chunk above 500 kB after minification. Build exit code is 0.

## Addendum regression evidence

- `CatalystIntelligence.behavior.test.tsx`: production manual and provider save actions still execute and retain the exact production Research Ledger success copy.
- `GuidedWalkthrough.test.tsx`: before-save Tutorial history is empty; manual and bundled six-contract saves create temporary history; provider controls remain disabled; zero `fetch` calls occur; restart clears the snapshot; Tutorial trade/exit copy is truthful and the Exit action does not claim to save a Debrief.
- `TradesPage.test.tsx`: production actual-fill and actual-closing attestations, `Record Trade`, and `Record Exit & Debrief` remain exact.
- `tutorial-workspace.test.ts`: the snapshot flag gates the Intelligence stage, changes the Tutorial-derived Research Ledger, reconstructs deterministic prerequisites, and clears without touching production-shaped state.
- `SharedTutorialUi.test.tsx`: behaviorally renders the production Catalyst page and Guided stage, then proves both expose the same controlled `CatalystEditor` surface and fields.
- `GuidedWalkthrough.test.tsx`: also completes the real shared Catalyst, Intelligence, Idea, Candidate, Record Trade, Trade detail, Check-In, Exit, Debrief, and Insights surfaces; asserts exact economics, keyboard safety, serialization, and failure unlock.
- production Ideas/Trades/Journal tests assert the same `data-shared-ui` layers used by the Guided story.
- `tutorial-workspace.test.ts`: full state story, deterministic reconstruct/clear, unchanged production-shaped Workspace, and no-write/provider import boundary including `tutorial-ui-adapter.ts`.
- `placement.test.ts`: 13 deterministic target-protection cases. Returned cards never overlap targets at desktop, Settings, bottom navigation, 390, 375, or 320 widths; the engine returns no placement when no protected region mathematically exists.
- all prior Quick Tour keyboard, editable-control, modifier, focus, reduced-motion, transition lock, empty-target, route-target, and preference tests remain green.

## Live rendering

Attempted:

`npm run dev -- --host 127.0.0.1`

Result:

`listen EPERM: operation not permitted 127.0.0.1:5173`

No branch-level browser or screenshot claim is made. Run `PRODUCTION_ACCEPTANCE.md` after deploy.

## GitHub CI

GitHub Actions [run 31915193435](https://github.com/dkyaya/OJ/actions/runs/31915193435) on `d4ebaf1` passed:

- OJ Public Validate — pass
- OJ Public Test — pass
- OJ Public Build — pass
- OJ Public Security — pass, including `npm audit --audit-level=high`

The workflow emitted the existing non-failing annotation that checkout/setup-node v4 target Node.js 20 and were forced onto Node.js 24 by the runner. No job failed.

Do not merge until the owner completes live production acceptance.
