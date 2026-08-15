# Phase 9.1 Validation

Validated from `feature/phase-9-1-guided-workflow` at implementation head `e842aa1c78344779ac07683f5607d39478345dcf` on 2026-08-15.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | Pass, 58 files / 266 tests |
| `npm run build` | Pass, 1,688 modules transformed |
| `npm run copy:check` | Pass |
| `npm run privacy:check` | Pass |
| `npm audit --audit-level=high` | Pass, 0 vulnerabilities |
| `git diff --check` | Pass |

## Build output

- `dist/index.html`: 0.60 kB; 0.37 kB gzip
- CSS: 88.12 kB; 15.72 kB gzip
- JS: 790.79 kB; 213.20 kB gzip
- Advisory: Vite reports the existing JS chunk above 500 kB after minification. Build exit code is 0.

## Focused Phase 9.1 evidence

- `GuidedWalkthrough.test.tsx`: complete hands-on story, no provider request, exact economics, finish cleanup, editable arrows, Escape pause, serialization, failure unlock.
- `tutorial-workspace.test.ts`: full state story, production math, deterministic reconstruct/clear, unchanged production-shaped Workspace, structural production-write/provider import prohibition.
- `guided-tutorial.test.ts`: bounded preference fields, unrelated JSON preservation, version reset, stage clamp.
- `placement.test.ts`: 9 deterministic target-protection cases.
- Existing Product Tour keyboard/presentation/semantic-target tests remain green.

## Live rendering

Attempted:

`npm run dev -- --host 127.0.0.1`

Result:

`listen EPERM: operation not permitted 127.0.0.1:5173`

No branch-level browser or screenshot claim is made. Run `PRODUCTION_ACCEPTANCE.md` after deploy.

## GitHub CI

GitHub Actions run [`31913400832`](https://github.com/dkyaya/OJ/actions/runs/31913400832) on implementation head `e842aa1` passed all four required jobs:

- OJ Public Validate — pass
- OJ Public Test — pass
- OJ Public Build — pass
- OJ Public Security — pass

Do not merge until the owner also completes the live production acceptance matrix.
