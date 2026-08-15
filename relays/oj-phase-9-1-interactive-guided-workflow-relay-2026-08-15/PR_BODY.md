## Summary

- preserves the concise, read-only Quick Tour
- adds a separate hands-on Guided Walkthrough from Catalyst through Insights
- keeps all synthetic Tutorial objects inside an isolated in-memory Tutorial Workspace
- uses bundled option fixtures and production payoff, P/L, option-chain, and scenario utilities
- adds collision-aware Quick Tour placement so highlighted targets remain visible
- exposes Quick Tour and Guided Walkthrough replay/resume controls in Settings

## Safety boundaries

- no canonical Catalyst, Idea, Candidate, Trade, Check-In, Exit, Debrief, forecast, snapshot, or activity rows
- zero market/government-provider requests and zero provider-cache writes
- no brokerage connection, credential access, or order behavior
- no effect on real risk, Journal, Insights, calibration, collaboration, activity, or exports
- preferences store only versioned onboarding status and progress
- no Supabase migration

## Guided story

The synthetic `OJ Tutorial Co. (OJDEMO)` flow creates an earnings Catalyst, reviews a bundled 95/100/105 option fixture, saves a 100/105 bull call Candidate at $1.40, records a simulated $1.32 fill, adds an Intact Check-In, records a $2.10 exit, derives +$78 before fees, and finishes with Debrief/Insights context. Finish, restart, exit, and sign-out clear tutorial state; pause reconstructs deterministic prerequisites on resume.

## Validation

- `npm run typecheck` — passed
- `npm run lint` — passed with zero warnings
- `npm test` — 58 files / 266 tests passed
- `npm run build` — passed; existing >500 kB chunk warning remains
- `npm run copy:check` — passed
- `npm run privacy:check` — passed
- `npm audit --audit-level=high` — 0 vulnerabilities
- `git diff --check` — passed

Local browser rendering remains unavailable because the Work sandbox rejects local listener creation with `EPERM`. The relay includes an exact post-deploy desktop/tablet/mobile acceptance matrix. No visual QA is claimed for this branch.

## Scope

Phase 9.1 only. No Phase 10 work. This PR is intentionally draft and must not be merged without owner review.
