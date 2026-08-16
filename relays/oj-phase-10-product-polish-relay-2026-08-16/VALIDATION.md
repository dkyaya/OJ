# Validation

## Application

Run from `app/`:

```text
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run copy:check
npm run privacy:check
npm audit --audit-level=high
GITHUB_ACTIONS=true npm run build
```

Results on 2026-08-16:

- TypeScript: passed.
- ESLint: passed, zero warnings.
- Vitest: 60 test files passed; 283 tests passed.
- Normal production build: passed; 1,697 modules transformed.
- GitHub Pages production build: passed; `/OJ/` asset base verified.
- Copy check: passed.
- Privacy check: passed.
- Audit: zero vulnerabilities.
- PWA: manifest start URL remains relative; service worker remains registered from the build base.

Repository:

```text
git diff --check
```

Result: passed.

## Supabase rollback-only validation

All writes used synthetic `.invalid` identities and ended with rollback. No real journal record was read, changed, or invited.

Passed suites:

- `rls.sql`
- `account-invite-activation.sql`
- `canonical-two-user-rls.sql`
- `catalyst-first-research-two-user-rls.sql`
- `phases-5-8-two-user-privacy.sql`
- `phase-8-5-1-snapshot-lifecycle-two-user-rls.sql`
- `phase-8-6-research-to-trade-two-user-rls.sql` (owner/member/non-member coverage)
- `phases-5-8-structure.sql`
- `phase-8-5-1-snapshot-lifecycle-structure.sql`
- `phase-8-6-research-to-trade-structure.sql`
- `catalyst-first-research-structure.sql`
- `phase-8-5-catalyst-intelligence-structure.sql`
- `idea-archive-lifecycle.sql`
- `idea-editing-canonical-schema.sql` with the Phase 10 migration installed inside the same rolled-back transaction

The suite confirms shared Catalyst provenance can feed a member-owned private Trade at entry, a non-member cannot use the Catalyst, cross-owner Trade/fill/check-in/debrief reads fail, removal ends future access, and existing entry provenance remains unchanged.

## Supabase advisors

No Phase 10 RLS regression was introduced. Current notices include:

- Browser-denied tables with RLS and intentionally no direct policies: informational.
- Authenticated security-definer functions: established protected application entrypoints with internal authorization; review remains documented.
- Leaked-password protection disabled: owner dashboard follow-up. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Warnings and failures

- Automated validation warnings: none.
- Automated validation failures: none after the synthetic fixtures and trigger compatibility migration were repaired.
- Production branch visual acceptance and migration deployment remain post-merge gates, not automated failures.
