# OJ Phase 10 — Product Polish & Shared-Use Readiness

Date: 2026-08-16

Public repository: `dkyaya/OJ`

Starting `main`: `75d949e`

Implementation commit at package generation: `c2c2b2c`

Branch: `feature/phase-10-product-polish`

## A. Baseline

Phase 9 and 9.1 were present on `main` at `75d949e`: the route-aware Quick Tour, isolated synthetic Guided Walkthrough, real-UI tutorial reuse, keyboard protections, and tutorial/provider isolation had landed. Phase 10 began from a freshly fetched `origin/main` on the dedicated branch above. The public repository remains code and synthetic fixtures only; the private journal repository was inspected but not changed because Supabase is the canonical application store and no mirror update was required.

The baseline application was functional but daily-use pages left avoidable space, summary cards did not consistently expose the next decision-relevant fact, the saved compact-card preference had no visible effect, completed onboarding actions were redundant, and the production bundle shipped most application code eagerly.

## B. Friction inventory

The complete inventory is in `FRICTION_INVENTORY.md`. No P0 issue was found. All identified P1 and P2 issues were repaired. Two manual P3 acceptance items remain: post-deployment light/dark visual review of the Phase 10 branch and a disposable second-account invitation drill chosen by the owner.

## C. Global design decisions

- Density: shorter page rhythm, tighter repeatable card gaps, and smaller non-calendar card padding.
- Spacing: consistent responsive gaps and two-column small metric grids where labels remain readable.
- Card hierarchy: identity/status first, decision facts second, supporting metadata last.
- Headers: restrained first-viewport height and short task-oriented subtitles.
- Buttons: one primary next action, quieter supporting actions, explicit separated destructive actions.
- Disclosure: full Journal reflections, editors, and deep research remain available through expandable/detail surfaces.
- Preference behavior: the saved compact-card setting now changes reusable card density while excluding calendars, forms, expandable panels, filter panels, and Catalyst Intelligence controls.

These decisions are recorded durably in `docs/PRODUCT_POLISH.md`.

## D. Page-by-page changes

### Overview

Active-Trade summaries now include expiry alongside contracts and confirmed max risk. Global rhythm reduces dead space without changing risk or account semantics.

### Catalysts

The full calendar remains a purpose-built information surface and is deliberately excluded from generic compact-card compression. The route now loads on demand.

### Intelligence

Catalyst Intelligence stays fully featured and is loaded with its route rather than the initial shell. Its scenario, evidence, provenance, and interaction panels are excluded from blanket density rules.

### Ideas

Idea summaries expose the primary linked Catalyst and candidate-structure count before deep detail. Build/edit/archive/delete behavior is unchanged except for the database trigger compatibility repair described below.

### Trades

Trade summaries now surface thesis health, next linked Catalyst, and expiration through a tested presentation helper. No brokerage connection or order execution was added.

### Journal

Journal cards use a concise reflection preview and one expandable panel for the complete reflection and linked Trade context. Full content remains available without repeating it across the collapsed page.

### Insights

The page receives the shared responsive rhythm and becomes a lazy route. Analytics meaning and privacy boundaries are unchanged.

### Workspace

Shared-use semantics remain intact. Workspace records continue to represent shared facts and deliberately shared research; private conclusions remain owner-scoped.

### Settings

Settings is tighter, its subtitle reflects account/workspace/risk/display responsibilities, compact-card preferences work, and Workspace Access explicitly separates **Shared research** from **Always personal** data. Invite success copy states that activation does not expose private OJ records.

## E. Redundancy cleanup

- Completed Guided Walkthrough: removed the adjacent redundant Restart action; only **Replay Guided Walkthrough** remains.
- Paused/in-progress Guided Walkthrough: **Resume Guided Walkthrough** and **Restart** remain distinct.
- Never-started Guided Walkthrough: **Start Guided Walkthrough** only.
- Completed Quick Tour: **Replay Quick Tour**; in progress: **Resume Quick Tour**; never started: **Start Quick Tour**.
- Journal: merged repeated reflection/context presentation into one disclosure panel.
- Summary lists: moved recurring next-step facts into the card summary so opening each record is not required.

## F. Contextual guidance

No standalone Contextual Guidance system was added. Small guidance remains only where layout cannot encode a security or product boundary safely: Workspace Access explains shared versus personal records; risk copy distinguishes OJ policy from brokerage buying power; synthetic tutorial labeling identifies disposable practice data. These are persistent semantic safeguards, not a new guidance layer.

## G. Shared-use readiness

- Invite UX states what an invited member receives and what remains private.
- Members can understand workspace role independently from OJ account role.
- Shared facts: Catalysts, evidence, missions, questions, and allowlisted activity remain workspace-visible when deliberately shared.
- Private conclusions: account values, risk policy, private Ideas/forecasts, Trades, fills, check-ins, exits, debriefs, and Journal records remain owner-scoped.
- Attribution remains present in the established shared-research model; Phase 10 does not replace it.
- No invitation was sent to a real friend during validation.

## H. Privacy/security

The complete synthetic SQL suite was run through trusted, rollback-only database sessions. Owner/member/non-member tests confirmed private records cannot be read cross-owner, inaccessible workspace facts cannot be used to create private Trades, member removal blocks future workspace access without mutating existing private Trade provenance, and archive/delete behavior remains owner-scoped.

RLS was not weakened. The structural RLS assertion was updated to accept only the two intentional owner-delete policies. Test-only ambiguous PL/pgSQL variables and stale synthetic fixtures were repaired. A narrow migration repairs the shared Idea/Candidate revision trigger by reading row-shape-specific fields safely and preserving the protected archive/restore RPC context. It adds no table, policy, or authorization expansion.

Supabase security advisors still report informational browser-denied/RLS tables, authenticated security-definer entrypoints already protected by internal authorization, and leaked-password protection being disabled. The latter remains an owner dashboard setting; see [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## I. Responsive QA

The signed-in production baseline was rendered with synthetic demo data across every requested class. The in-app browser scaled requested viewport values to 80% of their requested CSS size:

| Requested | Effective rendered size | Baseline route | Horizontal overflow |
| --- | --- | --- | --- |
| 1440×900 | 1152×720 | Overview | None |
| 1280×800 | 1024×640 | Catalysts | None |
| 1024×768 | 819×614 | Ideas | Clipped route-motion transform only; no page pan |
| 768×1024 | 614×819 | Trades | Clipped route-motion transform only; no page pan |
| 430×932 | 344×745 | Journal | None |
| 390×844 | 312×675 | Insights | None |
| 375×667 | 300×533 | Workspace | None |
| 320×568 | 256×454 | Settings | None |

This was the deployed Phase 9.1 baseline, not a false post-change claim. The local environment could not bind a preview listener, and browser security correctly blocked direct `file:` rendering. Phase 10 post-deployment review at the eight exact viewport sizes, in both light and dark themes, remains a production acceptance item. CSS and component tests cover density attributes and narrow layout behavior, but they do not replace that visual pass.

## J. Performance

Baseline production JavaScript: `786.85 kB` / `213.85 kB gzip` in one main bundle.

Phase 10 preloaded entry graph: `532.80 kB` / `152.08 kB gzip`.

Reduction: approximately `32.3%` uncompressed and `28.9%` gzip before the current route chunk.

Default Overview route: an additional `4.62 kB` / `1.61 kB gzip` plus shared on-demand dependencies.

CSS: `88.59 kB` / `15.80 kB gzip` before; `93.32 kB` / `16.77 kB gzip` after the new density layer.

All route pages, Guided Walkthrough, and Workflow are lazy-loaded. React, Supabase, and Lucide icons use stable manual vendor chunks. Catalyst Intelligence remains route-loaded rather than initial-shell code. The GitHub Actions build emits `/OJ/` asset paths, `manifest.webmanifest` retains relative start URL, and `sw.js` remains registered from `import.meta.env.BASE_URL`.

## K. Generated-file/repo hygiene

`app/tsconfig.tsbuildinfo` was removed from Git tracking and added to `.gitignore`. Builds may recreate it locally without dirtying the repository. Pre-existing unrelated untracked relay files were neither staged nor modified.

## L. Testing

Exact commands and SQL suites are recorded in `VALIDATION.md`.

- Typecheck: passed.
- Lint: passed with zero warnings.
- Unit/component tests: `60` files, `283` tests, all passed.
- Production build: passed locally and with `GITHUB_ACTIONS=true`.
- Copy check: passed.
- Public-repository privacy check: passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `git diff --check`: passed.
- Database structural, lifecycle, and two/three-user privacy suites: passed in rollback-only sessions.
- Failures remaining: none in automated validation.

## M. Browser QA

Actually rendered: the deployed production Phase 9.1 synthetic demo at the effective viewport sizes listed in Section I. Navigation, route content, bottom navigation, and no-horizontal-pan behavior were observed. No real private record was displayed or captured.

Not rendered as Phase 10: the local branch, because the sandbox could not expose a local HTTP listener and browser security rejected direct file navigation. No post-change screenshots are included. Remaining manual checks are listed in `PRODUCTION_ACCEPTANCE.md`.

## N. Production acceptance

`PRODUCTION_ACCEPTANCE.md` contains three explicit checklists:

1. Phase 10 polish and exact-viewport light/dark review after Pages deploys.
2. Disposable temp-member invite/shared-use/privacy drill, never the real friend unless the owner chooses.
3. Cleanup, migration verification, and rollback steps.

The new migration must be deployed through the established Supabase workflow after merge before Idea-candidate edits and archive/restore are accepted as production-verified.

## O. Git

- Branch: `feature/phase-10-product-polish`
- Base: `main` at `75d949e`
- Implementation commit: `c2c2b2c` (`Polish OJ for daily and shared use`)
- Current head at package generation: `c2c2b2c`
- Draft PR target: `dkyaya/OJ:main`
- Draft PR title: `Polish OJ for daily and shared use`
- Draft PR: `#26`, https://github.com/dkyaya/OJ/pull/26
- Published branch head before this CI record: `3244e01`
- Local validation: green.
- Remote CI run `31953256653`: OJ Public Validate, Test, Build, and Security all passed.
- Merge: not performed; the owner remains final merge authority.

## P. Blockers / uncertainties

- Post-change visual acceptance is manual until the branch is deployed; this relay does not mislabel the production baseline as Phase 10.
- The Supabase migration is intentionally not applied to production from an unmerged feature branch.
- A full disposable second-account browser invitation drill remains owner-approved production acceptance work. Synthetic two/three-user database privacy coverage is green.
- Supabase leaked-password protection remains disabled in the project dashboard.

## Q. Recommendation

1. **Is OJ ready for the owner to invite their real friend?** Not quite. Merge only after CI, deploy the migration and Pages build, complete the exact-viewport light/dark pass, and run the disposable temp-member checklist. If those pass, invite the real friend.
2. **Is standalone Contextual Guidance still necessary?** No. Clear hierarchy and small boundary-specific copy solve the identified need.
3. **Does OJ need another feature phase?** No large feature phase is justified by current evidence.
4. **What next?** Move into final stabilization and real two-person use, then repair only concrete defects or add a narrowly justified capability based on actual usage.

STOP. Do not begin another phase. Brokerage functionality remains out of scope.
