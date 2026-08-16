## Summary

- tighten OJ's responsive daily-use density and information hierarchy
- make compact cards functional while protecting complex calendar, form, and Intelligence surfaces
- expose the next relevant Catalyst, expiry, thesis health, and Journal context in summaries
- clean up Quick Tour and Guided Walkthrough Start/Resume/Replay/Restart semantics
- clarify workspace shared-research versus always-personal boundaries
- lazy-load routes, Guided Walkthrough, and Workflow; split stable vendor chunks
- remove tracked TypeScript build output
- repair the shared Idea/Candidate revision trigger and stale SQL fixtures without weakening RLS

## Why

Phase 9/9.1 completed onboarding. Phase 10 removes repeated daily-use friction and prepares OJ for a controlled second-user acceptance pass. The trigger repair was discovered by running the existing Idea edit and archive lifecycle suites: the shared trigger read an Idea-only field on Candidate rows and did not preserve the protected restore context.

## Impact

OJ uses space more efficiently, list cards expose decision-relevant facts sooner, Settings presents unambiguous onboarding actions, and invite/workspace copy explains privacy boundaries. Initial preloaded JavaScript falls from 786.85 kB / 213.85 kB gzip to 532.80 kB / 152.08 kB gzip. Brokerage access remains absent.

The Supabase migration must run after merge before production Idea editing/archive acceptance. It replaces one trigger function only; it adds no table or RLS policy.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run` — 60 files, 283 tests
- `npm run build`
- `GITHUB_ACTIONS=true npm run build`
- `npm run copy:check`
- `npm run privacy:check`
- `npm audit --audit-level=high` — 0 vulnerabilities
- `git diff --check`
- rollback-only Supabase structural, lifecycle, and owner/member/non-member RLS suites

## Acceptance boundary

Post-merge production acceptance still requires migration deployment, exact-viewport light/dark review, PWA smoke testing, and a disposable temp-member drill. No real friend was invited and no real private data entered the public repository.
